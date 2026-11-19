import { useEffect, useRef, useState } from 'react';
import type { AppSocket } from '../types';
import { getReason, getString, isRecord } from '../utils/guards';
import { generateId } from '../utils/id';
import { debugLog } from '../utils/logger';
import {
  NO_ANSWER_TIMEOUT_MS,
  createIceSignaler,
  describeMediaError,
  describeTracks,
  getIceServers,
  getLocalMedia,
  parseIceCandidate,
  parseSessionDescription,
  type IceSignaler,
} from '../utils/webrtc';
import { useEventCallback } from './useEventCallback';
import { useRingtone } from './useRingtone';
import { useSocketEvent } from './useSocketEvent';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'ongoing';

/** Dữ liệu và hành động cuộc gọi truyền xuống component. */
export interface VideoCallState {
  status: CallStatus;
  peerName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;
  canStartCall: boolean;
  startCall: (receiver?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  cancelCall: () => void;
  endCall: () => void;
}

const DEFAULT_PEER = 'admin';

type Options = {
  socket: AppSocket | null;
  isConnected: boolean;
};

/** Cuộc gọi video 1-1 giữa user và admin qua WebRTC, signaling qua socket. */
export const useVideoCall = ({ socket, isConnected }: Options) => {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Lỗi cuộc gọi tách khỏi lỗi chat để không ghi đè nhau.
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalerRef = useRef<IceSignaler | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerNameRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const noAnswerTimerRef = useRef<number | null>(null);
  const ringtone = useRingtone();

  const clearNoAnswerTimer = () => {
    if (noAnswerTimerRef.current !== null) {
      window.clearTimeout(noAnswerTimerRef.current);
      noAnswerTimerRef.current = null;
    }
  };

  /** Đường thoát duy nhất của một cuộc gọi; gọi nhiều lần vẫn an toàn. */
  const cleanupCall = useEventCallback(() => {
    clearNoAnswerTimer();
    pcRef.current?.close();
    pcRef.current = null;
    signalerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    callIdRef.current = null;
    setPeerName(null);
    peerNameRef.current = null;
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    ringtone.stop();
  });

  // Mất socket thì không còn kênh signaling: kết thúc cuộc gọi.
  useEffect(() => {
    if (!isConnected) cleanupCall();
  }, [isConnected, cleanupCall]);

  useEffect(() => () => cleanupCall(), [cleanupCall]);

  const getPeer = () => peerNameRef.current ?? DEFAULT_PEER;

  /** Gửi tín hiệu kết thúc (reject/cancel/end) cho phía bên kia rồi dọn cuộc gọi. */
  const finishCall = useEventCallback((event: 'call:reject' | 'call:cancel' | 'call:end') => {
    const callId = callIdRef.current;
    if (callId) socket?.emit(event, { callId, receiver: getPeer() });
    cleanupCall();
  });

  const addIceCandidateOrQueue = async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[call] addIceCandidate failed', err);
    }
  };

  const flushPendingIceCandidates = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription || pendingIceCandidatesRef.current.length === 0) return;
    const candidates = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[call] add queued ICE candidate failed', err);
      }
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    const signaler = createIceSignaler((candidate) => {
      const callId = callIdRef.current;
      if (callId) socket?.emit('call:ice-candidate', { callId, receiver: getPeer(), candidate });
    });
    pcRef.current = pc;
    signalerRef.current = signaler;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const [remote] = event.streams;
      debugLog('[call] ontrack', describeTracks(remote));
      setRemoteStream(remote ?? null);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) signaler.push(event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      debugLog('[call] connectionState', pc.connectionState);
      if (pc.connectionState === 'failed' && pcRef.current === pc) {
        setError('Kết nối cuộc gọi thất bại');
        finishCall('call:end');
      }
    };
    return pc;
  };

  /** Xin camera/micro; lỗi thì báo theo nguyên nhân và trả `null`. */
  const acquireLocalStream = async () => {
    try {
      const stream = await getLocalMedia();
      debugLog('[call] acquired local stream', describeTracks(stream));
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      setError(describeMediaError(err));
      return null;
    }
  };

  const startCall = useEventCallback(async (receiver: string = DEFAULT_PEER) => {
    if (receiver !== DEFAULT_PEER) {
      setError('User chỉ được gọi tới admin');
      return;
    }
    // Chặn bấm gọi hai lần tạo hai PeerConnection.
    if (status !== 'idle' || pcRef.current) return;

    setError(null);
    // Gán callId trước khi tạo PeerConnection để ICE candidate sớm có id đúng.
    const callId = generateId();
    callIdRef.current = callId;
    peerNameRef.current = receiver;
    setPeerName(receiver);
    setStatus('calling');

    const stream = await acquireLocalStream();
    if (!stream || callIdRef.current !== callId) {
      if (callIdRef.current === callId) cleanupCall();
      return;
    }

    try {
      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      debugLog('[call] emit call:invite', callId);
      socket?.emit('call:invite', { callId, receiver, mediaType: 'video', offer }, (ack) => {
        const ackCallId = isRecord(ack) && ack.ok === true ? getString(ack, 'callId') : undefined;
        if (ackCallId && callIdRef.current === callId) callIdRef.current = ackCallId;
      });
      signalerRef.current?.open();

      noAnswerTimerRef.current = window.setTimeout(() => {
        setError('Không có ai nghe máy');
        finishCall('call:cancel');
      }, NO_ANSWER_TIMEOUT_MS);
    } catch (err) {
      console.error('[call] start failed', err);
      setError('Không thể bắt đầu cuộc gọi');
      cleanupCall();
    }
  });

  const acceptCall = useEventCallback(async () => {
    const offer = pendingOfferRef.current;
    const callId = callIdRef.current;
    if (!offer || !callId || pcRef.current) return;

    setError(null);
    const stream = await acquireLocalStream();
    if (!stream) {
      finishCall('call:reject');
      return;
    }

    try {
      const pc = createPeerConnection(stream);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit('call:accept', { callId, receiver: getPeer(), answer });
      signalerRef.current?.open();
      ringtone.stop();
      setStatus('ongoing');
    } catch (err) {
      console.error('[call] accept failed', err);
      setError('Lỗi khi chấp nhận cuộc gọi');
      finishCall('call:reject');
    }
  });

  const rejectCall = useEventCallback(() => finishCall('call:reject'));
  const cancelCall = useEventCallback(() => finishCall('call:cancel'));
  const endCall = useEventCallback(() => finishCall('call:end'));

  useSocketEvent(socket, 'call:incoming', (payload) => {
    if (!isRecord(payload)) return;
    const callId = getString(payload, 'callId');
    const caller = getString(payload, 'caller');
    if (!callId || !caller) return;
    // Đang trong một cuộc gọi khác: từ chối cuộc mới.
    if (status !== 'idle') {
      socket?.emit('call:reject', { callId, receiver: caller });
      return;
    }
    setError(null);
    setStatus('incoming');
    setPeerName(caller);
    peerNameRef.current = caller;
    callIdRef.current = callId;
    pendingOfferRef.current = parseSessionDescription(payload.offer);
    void ringtone.play();
  });

  useSocketEvent(socket, 'call:accepted', (payload) => {
    const answer = isRecord(payload) ? parseSessionDescription(payload.answer) : null;
    const pc = pcRef.current;
    if (!pc || !answer) return;
    clearNoAnswerTimer();
    void (async () => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates();
        setStatus('ongoing');
      } catch (err) {
        console.error('[call] setRemoteDescription failed', err);
        setError('Kết nối cuộc gọi thất bại');
        finishCall('call:end');
      }
    })();
  });

  useSocketEvent(socket, 'call:ice-candidate', (payload) => {
    const candidate = isRecord(payload) ? parseIceCandidate(payload.candidate) : null;
    if (candidate) void addIceCandidateOrQueue(candidate);
  });

  useSocketEvent(socket, 'call:error', (payload) => {
    setError(getReason(payload) ?? 'Call error');
    cleanupCall();
  });

  // BE dùng cả hai dạng tên event (quá khứ và hiện tại) cho cùng một ý nghĩa.
  useSocketEvent(socket, 'call:rejected', cleanupCall);
  useSocketEvent(socket, 'call:cancelled', cleanupCall);
  useSocketEvent(socket, 'call:cancel', cleanupCall);
  useSocketEvent(socket, 'call:ended', cleanupCall);
  useSocketEvent(socket, 'call:end', cleanupCall);

  return {
    status,
    peerName,
    localStream,
    remoteStream,
    error,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
  };
};

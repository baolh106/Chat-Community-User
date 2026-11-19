import { useEffect, useRef, useState } from 'react';
import type { AppSocket } from '../types';
import { getReason, getString, isRecord } from '../utils/guards';
import { generateId } from '../utils/id';
import { debugLog } from '../utils/logger';
import {
  ICE_SERVERS,
  describeTracks,
  parseIceCandidate,
  parseSessionDescription,
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
  onError: (message: string | null) => void;
};

/** Cuộc gọi video 1-1 giữa user và admin qua WebRTC, signaling qua socket. */
export const useVideoCall = ({ socket, isConnected, onError }: Options) => {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerNameRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringtone = useRingtone();

  const cleanupCall = useEventCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      debugLog('[call] ontrack', describeTracks(stream));
      setRemoteStream(stream ?? null);
    };
    pc.onicecandidate = (event) => {
      const callId = callIdRef.current;
      if (!event.candidate || !callId) return;
      socket?.emit('call:ice-candidate', {
        callId,
        receiver: getPeer(),
        candidate: event.candidate.toJSON(),
      });
    };
    return pc;
  };

  const startCall = useEventCallback(async (receiver: string = DEFAULT_PEER) => {
    if (receiver !== DEFAULT_PEER) {
      onError('User chỉ được gọi tới admin');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      debugLog('[call] acquired local stream', describeTracks(stream));
      setLocalStream(stream);
      localStreamRef.current = stream;
      setStatus('calling');
      setPeerName(receiver);
      peerNameRef.current = receiver;

      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (!callIdRef.current) callIdRef.current = generateId();
      const invite = { callId: callIdRef.current, receiver, mediaType: 'video' as const, offer };
      debugLog('[call] emit call:invite', invite.callId);
      socket?.emit('call:invite', invite, (ack) => {
        const ackCallId = isRecord(ack) && ack.ok === true ? getString(ack, 'callId') : undefined;
        if (ackCallId) callIdRef.current = ackCallId;
      });
    } catch {
      onError('Không thể truy cập camera/micro');
      cleanupCall();
    }
  });

  const acceptCall = useEventCallback(async () => {
    const offer = pendingOfferRef.current;
    const callId = callIdRef.current;
    if (!offer || !callId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      debugLog('[call] acquired local stream for accept', describeTracks(stream));
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(stream);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit('call:accept', { callId, receiver: getPeer(), answer });
      ringtone.stop();
      setStatus('ongoing');
    } catch {
      onError('Lỗi khi chấp nhận cuộc gọi');
      cleanupCall();
    }
  });

  /** Gửi tín hiệu kết thúc (reject/cancel/end) cho phía bên kia rồi dọn cuộc gọi. */
  const finishCall = (event: 'call:reject' | 'call:cancel' | 'call:end') => {
    const callId = callIdRef.current;
    if (callId) socket?.emit(event, { callId, receiver: getPeer() });
    cleanupCall();
  };

  const rejectCall = useEventCallback(() => finishCall('call:reject'));
  const cancelCall = useEventCallback(() => finishCall('call:cancel'));
  const endCall = useEventCallback(() => finishCall('call:end'));

  useSocketEvent(socket, 'call:incoming', (payload) => {
    if (!isRecord(payload)) return;
    const callId = getString(payload, 'callId');
    const caller = getString(payload, 'caller');
    if (!callId || !caller) return;
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
    void (async () => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates();
        setStatus('ongoing');
      } catch (err) {
        console.error('[call] setRemoteDescription failed', err);
      }
    })();
  });

  useSocketEvent(socket, 'call:ice-candidate', (payload) => {
    const candidate = isRecord(payload) ? parseIceCandidate(payload.candidate) : null;
    if (candidate) void addIceCandidateOrQueue(candidate);
  });

  useSocketEvent(socket, 'call:error', (payload) => {
    onError(getReason(payload) ?? 'Call error');
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
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
  };
};

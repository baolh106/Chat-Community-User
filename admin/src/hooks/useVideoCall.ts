import { useEffect, useRef, useState } from 'react';
import type { AppSocket, CallInfo } from '../types';
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
} from '../utils/webrtc';
import { useEventCallback } from './useEventCallback';
import { useRingtone } from './useRingtone';
import { useSocketEvent } from './useSocketEvent';

export type CallStatus = 'idle' | 'ringing' | 'incoming' | 'ongoing';

/** Dữ liệu và hành động cuộc gọi truyền xuống component. */
export interface VideoCallState {
  status: CallStatus;
  activeCalls: CallInfo[];
  incomingCalls: CallInfo[];
  localStream: MediaStream | null;
  error: string | null;
  canStartCall: boolean;
  isVideoCallModalVisible: boolean;
  startCall: (receiver?: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => void;
  cancelCall: () => void;
  endCall: (callId?: string) => void;
  toggleVideoCallModal: () => void;
}

const ADMIN_ID = 'admin';

type Options = {
  socket: AppSocket | null;
  isConnected: boolean;
};

const stopSenderTracks = (pc: RTCPeerConnection) => {
  pc.getSenders().forEach((sender) => sender.track?.stop());
};

/** Mỗi PeerConnection dùng bản clone của stream local để tắt track một cuộc không ảnh hưởng cuộc khác. */
const clonePeerStream = (stream: MediaStream) =>
  new MediaStream(stream.getTracks().map((track) => track.clone()));

/** Admin có thể nhận và giữ nhiều cuộc gọi video cùng lúc, mỗi cuộc một RTCPeerConnection. */
export const useVideoCall = ({ socket, isConnected }: Options) => {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [activeCalls, setActiveCalls] = useState<CallInfo[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<CallInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(true);
  // Lỗi cuộc gọi tách khỏi lỗi chat để không ghi đè nhau.
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const activeCallsRef = useRef<CallInfo[]>([]);
  const incomingCallsRef = useRef<CallInfo[]>([]);
  // callId → timer tự huỷ cuộc gọi đi khi không ai nghe máy.
  const noAnswerTimersRef = useRef(new Map<string, number>());
  const ringtone = useRingtone();

  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  useEffect(() => {
    incomingCallsRef.current = incomingCalls;
  }, [incomingCalls]);

  const releaseLocalStream = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const clearNoAnswerTimer = (callId: string) => {
    window.clearTimeout(noAnswerTimersRef.current.get(callId));
    noAnswerTimersRef.current.delete(callId);
  };

  const cleanupCall = useEventCallback((callId: string) => {
    clearNoAnswerTimer(callId);
    const pc = peerConnectionsRef.current.get(callId);
    if (pc) {
      stopSenderTracks(pc);
      pc.close();
      peerConnectionsRef.current.delete(callId);
    }
    pendingIceCandidatesRef.current.delete(callId);

    const remainingActive = activeCallsRef.current.filter((c) => c.callId !== callId);
    const remainingIncoming = incomingCallsRef.current.filter((c) => c.callId !== callId);
    setActiveCalls(remainingActive);
    setIncomingCalls(remainingIncoming);

    if (remainingIncoming.length === 0) ringtone.stop();
    if (remainingActive.length === 0 && remainingIncoming.length === 0) {
      releaseLocalStream();
      setStatus('idle');
    }
  });

  const cleanupAllCalls = useEventCallback(() => {
    noAnswerTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    noAnswerTimersRef.current.clear();
    peerConnectionsRef.current.forEach((pc) => {
      stopSenderTracks(pc);
      pc.close();
    });
    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setActiveCalls([]);
    setIncomingCalls([]);
    setStatus('idle');
    ringtone.stop();
    releaseLocalStream();
  });

  // Mất socket thì không còn kênh signaling: kết thúc mọi cuộc gọi.
  useEffect(() => {
    if (!isConnected) cleanupAllCalls();
  }, [isConnected, cleanupAllCalls]);

  useEffect(() => () => cleanupAllCalls(), [cleanupAllCalls]);

  const ensureLocalStream = useEventCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
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
  });

  // Có cuộc gọi mà chưa có camera/micro (vd. cuộc gọi đến) thì xin quyền sớm để hiện preview.
  useEffect(() => {
    if ((activeCalls.length > 0 || incomingCalls.length > 0) && !localStream) {
      void ensureLocalStream();
    }
  }, [activeCalls.length, incomingCalls.length, localStream, ensureLocalStream]);

  const queueIceCandidate = (callId: string, candidate: RTCIceCandidateInit) => {
    const pending = pendingIceCandidatesRef.current.get(callId) ?? [];
    pending.push(candidate);
    pendingIceCandidatesRef.current.set(callId, pending);
  };

  const addIceCandidateOrQueue = async (callId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(callId);
    if (!pc || !pc.remoteDescription) {
      queueIceCandidate(callId, candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[call] addIceCandidate failed', callId, err);
    }
  };

  const flushPendingIceCandidates = async (callId: string) => {
    const pc = peerConnectionsRef.current.get(callId);
    const candidates = pendingIceCandidatesRef.current.get(callId) ?? [];
    if (!pc || !pc.remoteDescription || candidates.length === 0) return;
    pendingIceCandidatesRef.current.delete(callId);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[call] add queued ICE candidate failed', callId, err);
      }
    }
  };

  /** Gửi `call:end` cho một cuộc gọi đang diễn ra rồi dọn nó. */
  const endActiveCall = useEventCallback((callId: string) => {
    const activeCall = activeCallsRef.current.find((c) => c.callId === callId);
    if (activeCall) socket?.emit('call:end', { callId, receiver: activeCall.caller });
    cleanupCall(callId);
  });

  /**
   * Tạo PeerConnection cho một cuộc gọi. `getCallId` đọc id hiện tại vì server
   * có thể cấp lại callId trong ack của `call:invite`. ICE candidate local được giữ
   * lại tới khi gọi `signaler.open()` (sau khi đã gửi offer/answer).
   */
  const createPeerConnection = (
    getCallId: () => string,
    receiver: string,
    stream: MediaStream,
  ) => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    const signaler = createIceSignaler((candidate) => {
      socket?.emit('call:ice-candidate', { callId: getCallId(), receiver, candidate });
    });
    const peerStream = clonePeerStream(stream);
    peerStream.getTracks().forEach((track) => pc.addTrack(track, peerStream));
    pc.ontrack = (event) => {
      const [remote] = event.streams;
      const callId = getCallId();
      debugLog('[call] ontrack', callId, describeTracks(remote));
      setActiveCalls((prev) =>
        prev.map((c) => (c.callId === callId ? { ...c, remoteStream: remote ?? null } : c)),
      );
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) signaler.push(event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const callId = getCallId();
      debugLog('[call] connectionState', callId, pc.connectionState);
      if (pc.connectionState === 'failed' && peerConnectionsRef.current.get(callId) === pc) {
        setError('Kết nối cuộc gọi thất bại');
        endActiveCall(callId);
      }
    };
    return { pc, signaler };
  };

  /** Server đổi callId trong ack: chuyển PeerConnection, ICE đang chờ và state sang id mới. */
  const renameCall = (fromId: string, toId: string) => {
    const pc = peerConnectionsRef.current.get(fromId);
    if (pc) {
      peerConnectionsRef.current.set(toId, pc);
      peerConnectionsRef.current.delete(fromId);
    }
    const pending = pendingIceCandidatesRef.current.get(fromId);
    if (pending) {
      pendingIceCandidatesRef.current.set(toId, pending);
      pendingIceCandidatesRef.current.delete(fromId);
    }
    const timer = noAnswerTimersRef.current.get(fromId);
    if (timer !== undefined) {
      noAnswerTimersRef.current.set(toId, timer);
      noAnswerTimersRef.current.delete(fromId);
    }
    setActiveCalls((prev) => prev.map((c) => (c.callId === fromId ? { ...c, callId: toId } : c)));
  };

  const startCall = useEventCallback(async (receiver: string) => {
    if (!receiver.trim() || receiver === ADMIN_ID) {
      setError('Admin chỉ được gọi user');
      return;
    }
    // Chặn gọi trùng tới một user đang có cuộc gọi.
    if (activeCallsRef.current.some((c) => c.caller === receiver)) return;
    setError(null);
    const stream = await ensureLocalStream();
    if (!stream) return;

    let callId = generateId();
    const { pc, signaler } = createPeerConnection(() => callId, receiver, stream);
    peerConnectionsRef.current.set(callId, pc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const hadActiveCall = activeCallsRef.current.length > 0;
      setActiveCalls((prev) => [
        ...prev,
        { callId, caller: receiver, remoteStream: null, status: 'outgoing', pc, offer },
      ]);
      debugLog('[call] emit call:invite', callId);
      socket?.emit('call:invite', { callId, receiver, mediaType: 'video', offer }, (ack) => {
        const ackCallId = isRecord(ack) && ack.ok === true ? getString(ack, 'callId') : undefined;
        if (ackCallId && ackCallId !== callId) {
          renameCall(callId, ackCallId);
          callId = ackCallId;
        }
      });
      signaler.open();
      setStatus(hadActiveCall ? 'ongoing' : 'ringing');

      noAnswerTimersRef.current.set(
        callId,
        window.setTimeout(() => {
          const call = activeCallsRef.current.find((c) => c.callId === callId);
          if (call?.status !== 'outgoing') return;
          setError(`${receiver} không nghe máy`);
          socket?.emit('call:cancel', { callId, receiver });
          cleanupCall(callId);
        }, NO_ANSWER_TIMEOUT_MS),
      );
    } catch (err) {
      console.error('[call] start failed', err);
      setError('Lỗi tạo offer');
      cleanupCall(callId);
    }
  });

  const acceptCall = useEventCallback(async (callId: string) => {
    const incomingCall = incomingCalls.find((c) => c.callId === callId);
    if (!incomingCall?.offer) return;
    if (peerConnectionsRef.current.has(callId)) return;
    setError(null);
    const stream = await ensureLocalStream();
    if (!stream) return;

    const { pc, signaler } = createPeerConnection(() => callId, incomingCall.caller, stream);
    peerConnectionsRef.current.set(callId, pc);

    try {
      setActiveCalls((prev) => [...prev, { ...incomingCall, status: 'ongoing', pc }]);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushPendingIceCandidates(callId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('call:accept', { callId, receiver: incomingCall.caller, answer });
      signaler.open();
      setIncomingCalls((prev) => {
        const next = prev.filter((c) => c.callId !== callId);
        if (next.length === 0) ringtone.stop();
        return next;
      });
      setStatus('ongoing');
    } catch (err) {
      console.error('[call] accept failed', err);
      setError('Lỗi khi chấp nhận gọi');
      socket?.emit('call:reject', { callId, receiver: incomingCall.caller });
      cleanupCall(callId);
    }
  });

  const rejectCall = useEventCallback((callId: string) => {
    const incomingCall = incomingCalls.find((c) => c.callId === callId);
    if (!incomingCall) return;
    socket?.emit('call:reject', { callId, receiver: incomingCall.caller });
    cleanupCall(callId);
  });

  // Huỷ cuộc gọi đi chưa được hỗ trợ ở admin.
  const cancelCall = useEventCallback(() => undefined);

  const endCall = useEventCallback((callId?: string) => {
    if (callId) {
      const activeCall = activeCalls.find((c) => c.callId === callId);
      if (!activeCall) return;
      socket?.emit('call:end', { callId, receiver: activeCall.caller });
      cleanupCall(callId);
      return;
    }
    activeCalls.forEach((c) => socket?.emit('call:end', { callId: c.callId, receiver: c.caller }));
    cleanupAllCalls();
  });

  const toggleModal = useEventCallback(() => setIsModalVisible((prev) => !prev));

  useSocketEvent(socket, 'call:incoming', (payload) => {
    if (!isRecord(payload)) return;
    const callId = getString(payload, 'callId');
    const caller = getString(payload, 'caller');
    if (!callId || !caller) return;
    debugLog('[call] incoming', callId, caller);

    const offer = parseSessionDescription(payload.offer) ?? undefined;
    setIncomingCalls((prev) => {
      const isKnown =
        prev.some((c) => c.callId === callId) ||
        activeCallsRef.current.some((c) => c.callId === callId);
      return isKnown
        ? prev
        : [...prev, { callId, caller, remoteStream: null, status: 'incoming', pc: null, offer }];
    });
    setStatus('ringing');
    setIsModalVisible(true);
    void ringtone.play();
  });

  useSocketEvent(socket, 'call:accepted', (payload) => {
    if (!isRecord(payload)) return;
    const callId = getString(payload, 'callId');
    const answer = parseSessionDescription(payload.answer);
    const pc = callId ? peerConnectionsRef.current.get(callId) : undefined;
    if (!callId || !pc || !answer) return;
    clearNoAnswerTimer(callId);
    void (async () => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates(callId);
        setActiveCalls((prev) =>
          prev.map((c) => (c.callId === callId ? { ...c, status: 'ongoing' } : c)),
        );
        setStatus('ongoing');
      } catch (err) {
        console.error('[call] setRemoteDescription failed', err);
        setError('Kết nối cuộc gọi thất bại');
        endActiveCall(callId);
      }
    })();
  });

  useSocketEvent(socket, 'call:ice-candidate', (payload) => {
    if (!isRecord(payload)) return;
    const callId = getString(payload, 'callId');
    const candidate = parseIceCandidate(payload.candidate);
    if (callId && candidate) void addIceCandidateOrQueue(callId, candidate);
  });

  const handleCallFinished = (payload: unknown) => {
    const callId = isRecord(payload) ? getString(payload, 'callId') : undefined;
    if (callId) cleanupCall(callId);
  };

  useSocketEvent(socket, 'call:error', (payload) => {
    setError(getReason(payload) ?? 'Call error');
    handleCallFinished(payload);
  });
  useSocketEvent(socket, 'call:rejected', handleCallFinished);
  useSocketEvent(socket, 'call:cancelled', handleCallFinished);
  useSocketEvent(socket, 'call:ended', handleCallFinished);

  return {
    status,
    activeCalls,
    incomingCalls,
    localStream,
    error,
    isVideoCallModalVisible: isModalVisible,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleVideoCallModal: toggleModal,
  };
};

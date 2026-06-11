import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../utils/socket';
import { api } from '../utils/api';
import type { Message, SocketPayload, ChatStatus, SocketFilePayload, CallInfo } from '../types';

const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

const IMAGE_EXTENSIONS = ['.apng', '.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp'];

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Tách bỏ phần prefix "data:*/*;base64," để lấy chuỗi base64 thuần túy
      const base64Part = result.split(',')[1];
      resolve(base64Part || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isImageFile = (file: File) => {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
};

const mapMessageError = (reason?: string) => {
  if (reason === 'file_too_large') return `File vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB`;
  if (reason === 'invalid_file_payload') return 'File đính kèm không hợp lệ';
  if (reason === 'message content or file is required') return 'Nhập nội dung hoặc chọn file để gửi';
  if (reason === 'invalid_payload') return 'Thiếu người nhận tin nhắn';
  if (reason === 'unauthorized') return 'Phiên đăng nhập không hợp lệ';
  return reason || 'Gửi message thất bại';
};

const createCallId = () => crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeMessage = (m: any): Message => {
  const attachments = Array.isArray(m.attachments) ? m.attachments.map((att: any) => {
    const name = att.name || att.fileName || '';
    const mimeType = att.mimeType || att.fileMimeType || '';
    const isImg = mimeType.startsWith('image/') || IMAGE_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

    return {
      ...att,
      url: att.url || att.fileURL,
      name,
      type: att.type || att.attachmentType || (isImg ? 'image' : 'file')
    };
  }) : [];

  if (m.fileURL && !attachments.some((a: any) => a.url === m.fileURL)) {
    const isImg = (m.fileMimeType?.startsWith('image/') || m.imageURL || IMAGE_EXTENSIONS.some((ext: string) => m.fileName?.toLowerCase().endsWith(ext)));
    attachments.push({
      url: m.fileURL,
      name: m.fileName,
      mimeType: m.fileMimeType,
      size: m.fileSize,
      type: m.attachmentType || (isImg ? 'image' : 'file')
    });
  }

  return {
    ...m,
    attachments: attachments.length > 0 ? attachments : undefined
  };
};

const upsertMessage = (messages: Message[], nextMessage: any) => {
  const normalized = normalizeMessage(nextMessage);

  const index = messages.findIndex(m =>
    (nextMessage.id && (m as any).id === nextMessage.id) ||
    (nextMessage.tempId && (m as any).tempId === nextMessage.tempId) ||
    (m.sender === nextMessage.sender && m.content === nextMessage.content &&
    Math.abs(new Date(m.createdAt).getTime() - new Date(nextMessage.createdAt).getTime()) < 2000)
  );

  if (index >= 0) {
    const next = [...messages];
    next[index] = { ...next[index], ...normalized };
    return next;
  }

  // Ngăn chặn việc tạo tin nhắn rác khi không tìm thấy tempId để update status
  if (!nextMessage.sender || !nextMessage.createdAt) {
    return messages;
  }

  return [...messages, normalized];
};

export interface VideoCallState {
  status: 'idle' | 'ringing' | 'incoming' | 'ongoing';
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

interface UseChatReturn {
  password: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  onlineUsers: string[];
  selectedUserId: string | null;
  unreadCounts: Record<string, number>;
  messages: Message[];
  draft: string;
  selectedFiles: File[];
  isSending: boolean;
  error: string | null;
  canSend: boolean;
  statusText: string;
  videoCall: VideoCallState;
  setPassword: (value: string) => void;
  setCaptchaToken: (token: string | null) => void;
  setDraft: (value: string) => void;
  setSelectedFiles: (files: File[]) => void;
  clearAttachment: () => void;
  setSelectedUserId: (userId: string | null) => void;
  startSession: () => Promise<void>;
  sendMessage: () => Promise<void>;
  resetSession: () => void;
}

export const useChat = (): UseChatReturn => {
  const [password, setPassword] = useState('');
  const [sessionNickname, setSessionNickname] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allUserMessages, setAllUserMessages] = useState<Record<string, Message[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video Call States
  const [callStatus, setCallStatus] = useState<VideoCallState['status']>('idle');
  const [activeCalls, setActiveCalls] = useState<CallInfo[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<CallInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoCallModalVisible, setIsVideoCallModalVisible] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const selectedFilesRef = useRef<File[]>(selectedFiles);
  const isSendingRef = useRef(isSending);
  const userIdRef = useRef(userId);
  const selectedUserIdRef = useRef(selectedUserId);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  const ringAudioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);
  const ringOscillatorRef2 = useRef<OscillatorNode | null>(null);
  const ringGainRef = useRef<GainNode | null>(null);
  const ringGainRef2 = useRef<GainNode | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const activeCallsRef = useRef<CallInfo[]>([]);
  const incomingCallsRef = useRef<CallInfo[]>([]);
  const refreshAttemptedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const canSend = Boolean(
    socketConnected && selectedUserId && !isSending && (draft.trim().length > 0 || selectedFiles.length > 0)
  );

  const statusText = useMemo(() => {
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Connected';
    if (status === 'disconnected') return 'Disconnected';
    if (status === 'error') return 'Connection error';
    return 'Not logged in';
  }, [status]);

  const STORAGE_KEY = 'admin_chat_auth';

  const saveAuth = (accessTokenValue: string, refreshTokenValue: string, nicknameValue: string) => {
    const payload = {
      accessToken: accessTokenValue,
      refreshToken: refreshTokenValue,
      sessionNickname: nicknameValue,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const clearStoredAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const resetSession = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setSessionNickname('');
    setUserId(null);
    setOnlineUsers([]);
    setSelectedUserId(null);
    setAllUserMessages({});
    setSelectedFiles([]);
    setIsSending(false);
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearStoredAuth();
  };

  const tryRefreshSession = async () => {
    if (!refreshToken || refreshToken.trim() === '') {
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      resetSession();
      return false;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setStatus('connecting');
        const data = await api.refreshSession(refreshToken);
        const token = data.data.accessToken;
        const refreshedRefreshToken = data.data.refreshToken || refreshToken;
        if (!token) {
          throw new Error('Không nhận được accessToken');
        }

        setAccessToken(token);
        setRefreshToken(refreshedRefreshToken);
        saveAuth(token, refreshedRefreshToken, sessionNickname || 'Administrator');
        setError(null);
        refreshAttemptedRef.current = false;
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session đã hết hạn. Vui lòng đăng nhập lại');
        resetSession();
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        accessToken: string;
        refreshToken: string;
        sessionNickname?: string;
      };
      if (parsed.accessToken && parsed.refreshToken) {
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken);
        setSessionNickname(parsed.sessionNickname || 'Administrator');
      }
    } catch {
      clearStoredAuth();
    }
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const cleanupCall = (callId: string) => {
    const pc = pcMapRef.current.get(callId);
    if (pc) {
      stopPeerConnectionTracks(pc);
      pc.close();
      pcMapRef.current.delete(callId);
    }
    pendingOffersRef.current.delete(callId);

    const remainingActive = activeCallsRef.current.filter(c => c.callId !== callId);
    const remainingIncoming = incomingCallsRef.current.filter(c => c.callId !== callId);

    setActiveCalls(remainingActive);
    setIncomingCalls(remainingIncoming);

    if (remainingIncoming.length === 0) stopRingtone();

    if (remainingActive.length === 0 && remainingIncoming.length === 0) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      setCallStatus('idle');
    }
  };

  const cleanupAllCalls = () => {
    pcMapRef.current.forEach((pc) => {
      stopPeerConnectionTracks(pc);
      pc.close();
    });
    pcMapRef.current.clear();
    pendingOffersRef.current.clear();
    setActiveCalls([]);
    setIncomingCalls([]);
    setCallStatus('idle');
    stopRingtone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const isAllowedReceiver = (receiver: string) => receiver.trim().length > 0 && receiver !== 'admin';

  const ensureLocalStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // log stream tracks for debugging camera/microphone issues
      // eslint-disable-next-line no-console
      console.log('[admin] acquired local stream', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      setError('Lỗi truy cập Media');
      return null;
    }
  };

  const createPeerStream = (stream: MediaStream) => {
    const clone = new MediaStream(stream.getTracks().map((track) => track.clone()));
    // eslint-disable-next-line no-console
    console.log('[admin] created peer stream clone', clone.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));
    return clone;
  };

  const stopPeerConnectionTracks = (pc: RTCPeerConnection) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        try {
          sender.track.stop();
        } catch {
          // ignore
        }
      }
    });
  };

  const playRingtone = async () => {
    if (ringTimerRef.current !== null) return;
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = ringAudioContextRef.current || new AudioContextClass();
    ringAudioContextRef.current = audioCtx;

    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        return;
      }
    }

    const playTone = () => {
      const ctx = ringAudioContextRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;

      const oscillator1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      oscillator1.type = 'square'; // Mechanical, sharp sound
      oscillator1.frequency.setValueAtTime(600, now);
      gain1.gain.setValueAtTime(0, now);

      const oscillator2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      oscillator2.type = 'square';
      oscillator2.frequency.setValueAtTime(800, now);
      gain2.gain.setValueAtTime(0, now);

      // Create 8 rapid "reng" pulses for mechanical effect
      for (let i = 0; i < 8; i++) {
        const pulseStart = now + i * 0.15;
        gain1.gain.linearRampToValueAtTime(0.2, pulseStart + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.01, pulseStart + 0.12);
        gain2.gain.linearRampToValueAtTime(0.2, pulseStart + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.01, pulseStart + 0.12);
      }

      oscillator1.connect(gain1);
      gain1.connect(ctx.destination);
      oscillator1.start(now);
      ringOscillatorRef.current = oscillator1;
      ringGainRef.current = gain1;

      oscillator2.connect(gain2);
      gain2.connect(ctx.destination);
      oscillator2.start(now);
      ringOscillatorRef2.current = oscillator2;
      ringGainRef2.current = gain2;

      // Ring for 1400ms
      window.setTimeout(() => {
        try {
          oscillator1.stop();
          oscillator2.stop();
          oscillator1.disconnect();
          oscillator2.disconnect();
          gain1.disconnect();
          gain2.disconnect();
          if (ringOscillatorRef.current === oscillator1) ringOscillatorRef.current = null;
          if (ringOscillatorRef2.current === oscillator2) ringOscillatorRef2.current = null;
          if (ringGainRef.current === gain1) ringGainRef.current = null;
          if (ringGainRef2.current === gain2) ringGainRef2.current = null;
        } catch {
          // ignore
        }
      }, 1400);
    };

    playTone();
    // Near continuous ring
    ringTimerRef.current = window.setInterval(playTone, 1500);
  };

  const stopRingtone = () => {
    if (ringTimerRef.current !== null) {
      window.clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (ringOscillatorRef.current) {
      try {
        ringOscillatorRef.current.stop();
      } catch {
        // ignore
      }
      ringOscillatorRef.current.disconnect();
      ringOscillatorRef.current = null;
    }
    if (ringOscillatorRef2.current) {
      try {
        ringOscillatorRef2.current.stop();
      } catch {
        // ignore
      }
      ringOscillatorRef2.current.disconnect();
      ringOscillatorRef2.current = null;
    }
    if (ringGainRef.current) {
      ringGainRef.current.disconnect();
      ringGainRef.current = null;
    }
    if (ringGainRef2.current) {
      ringGainRef2.current.disconnect();
      ringGainRef2.current = null;
    }
  };

  const startCall = async (receiver: string) => {
    if (!receiver || !isAllowedReceiver(receiver)) {
      setError('Admin chỉ được gọi user');
      return;
    }
    const stream = await ensureLocalStream();
    if (!stream) return;

    const callId = createCallId();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcMapRef.current.set(callId, pc);
    
    const peerStream = createPeerStream(stream);
    peerStream.getTracks().forEach((track) => pc.addTrack(track, peerStream));
    pc.ontrack = (e) => {
      const s = e.streams[0];
      // eslint-disable-next-line no-console
      console.log('[admin] pc.ontrack', callId, s, 'tracks=', s?.getTracks().map(t=>({kind:t.kind, id:t.id})));
      setActiveCalls(prev => {
        const next = prev.map(c => c.callId === callId ? { ...c, remoteStream: s } : c);
        // eslint-disable-next-line no-console
        console.log('[admin] updated activeCalls remoteStream for', callId, 'streamTracks=', s?.getTracks().length);
        return next;
      });
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        // eslint-disable-next-line no-console
        console.log('[admin] sending ice candidate', callId, e.candidate);
        socketRef.current?.emit('call:ice-candidate', { callId, receiver, candidate: e.candidate });
      }
    };
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setActiveCalls(prev => [...prev, { callId, caller: receiver, remoteStream: null, status: 'outgoing', pc, offer }]);
      const payload = { callId, receiver, mediaType: 'video', offer };
      console.log('[admin] emit call:invite', payload);
      socketRef.current?.emit('call:invite', payload, (ack: any) => {
        if (ack?.ok && ack.callId) {
          // Update callId if server changed it
          setActiveCalls(prev => prev.map(c => c.callId === callId ? { ...c, callId: ack.callId } : c));
          pcMapRef.current.set(ack.callId, pcMapRef.current.get(callId)!);
          pcMapRef.current.delete(callId);
        }
      });
      setCallStatus(activeCalls.length > 0 ? 'ongoing' : 'ringing');
    } catch (err) {
      setError('Lỗi tạo offer');
      cleanupCall(callId);
    }
  };

  const acceptCall = async (callId: string) => {
    const incomingCall = incomingCalls.find(c => c.callId === callId);
    if (!incomingCall || !incomingCall.offer) return;

    const stream = await ensureLocalStream();
    if (!stream) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcMapRef.current.set(callId, pc);
    
    const peerStream = createPeerStream(stream);
    peerStream.getTracks().forEach((track) => pc.addTrack(track, peerStream));
    pc.ontrack = (e) => {
      const s = e.streams[0];
      // eslint-disable-next-line no-console
      console.log('[admin] pc.ontrack (accept)', callId, s, 'tracks=', s?.getTracks().map(t=>({kind:t.kind, id:t.id})));
      setActiveCalls(prev => {
        const next = prev.map(c => c.callId === callId ? { ...c, remoteStream: s } : c);
        // eslint-disable-next-line no-console
        console.log('[admin] updated activeCalls (accept) remoteStream for', callId, 'streamTracks=', s?.getTracks().length);
        return next;
      });
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        // eslint-disable-next-line no-console
        console.log('[admin] sending ice candidate (accept)', callId, incomingCall.caller, e.candidate);
        socketRef.current?.emit('call:ice-candidate', { callId, receiver: incomingCall.caller, candidate: e.candidate });
      }
    };
    
    try {
      setActiveCalls(prev => [...prev, { ...incomingCall, status: 'ongoing', pc }]);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call:accept', { callId, receiver: incomingCall.caller, answer });
      setIncomingCalls(prev => {
        const next = prev.filter(c => c.callId !== callId);
        if (next.length === 0) {
          stopRingtone();
        }
        return next;
      });
      setCallStatus('ongoing');
    } catch (err) {
      setError('Lỗi khi chấp nhận gọi');
      cleanupCall(callId);
    }
  };

  const rejectCall = (callId: string) => {
    const incomingCall = incomingCalls.find(c => c.callId === callId);
    if (!incomingCall) return;
    console.log('[admin] emit call:reject', { callId, receiver: incomingCall.caller });
    socketRef.current?.emit('call:reject', { callId, receiver: incomingCall.caller });
    cleanupCall(callId);
  };

  const cancelCall = () => {
    // Cancel outgoing calls (not implemented for simple version)
  };

  const endCall = (callId?: string) => {
    if (callId) {
      const activeCall = activeCalls.find(c => c.callId === callId);
      if (activeCall) {
        console.log('[admin] emit call:end', { callId, receiver: activeCall.caller });
        socketRef.current?.emit('call:end', { callId, receiver: activeCall.caller });
        cleanupCall(callId);
      }
    } else {
      // End all calls
      activeCalls.forEach(c => {
        socketRef.current?.emit('call:end', { callId: c.callId, receiver: c.caller });
      });
      cleanupAllCalls();
    }
  };

  const messages = useMemo(() => {
    return selectedUserId ? allUserMessages[selectedUserId] || [] : [];
  }, [allUserMessages, selectedUserId]);

  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  useEffect(() => {
    incomingCallsRef.current = incomingCalls;
  }, [incomingCalls]);

  useEffect(() => {
    if (onlineUsers.length > 0 && selectedUserId === null) {
      setSelectedUserId(onlineUsers[0]);
    }
  }, [onlineUsers, selectedUserId]);

  useEffect(() => {
    if ((activeCalls.length > 0 || incomingCalls.length > 0) && !localStream && !localStreamRef.current) {
      ensureLocalStream();
    }
  }, [activeCalls.length, incomingCalls.length, localStream]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = createSocket(accessToken);
    socketRef.current = socket;
    setStatus('connecting');

    const handleConnect = () => {
      console.log('Admin socket connected, emitting admin:join');
      setSocketConnected(true);
      setStatus('connected');
      socket.emit('admin:join');
    };

    socket.on('connect', handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setStatus('disconnected');
      cleanupAllCalls();
    });

    socket.on('connect_error', async (err: Error) => {
      console.error('connect_error', err);
      const message = err?.message || '';
      const isAuthError = /unauthorized|token|expired|jwt|authentication/i.test(message);

      if (isAuthError && !refreshAttemptedRef.current) {
        refreshAttemptedRef.current = true;
        socket.disconnect();
        socketRef.current = null;
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          setStatus('error');
        }
        return;
      }

      setError('Fail connection.');
      setStatus('error');
      cleanupAllCalls();
    });

    socket.on('admin:joined', async (payload: { ok: boolean; userIds?: string[]; history?: Record<string, Message[]>; reason?: string }) => {
      if (payload.ok && payload.userIds) {
        const rawHistory = payload.history || {};
        const normalizedHistory: Record<string, Message[]> = {};
        
        Object.keys(rawHistory).forEach((uid) => {
          normalizedHistory[uid] = rawHistory[uid].map((m) => normalizeMessage(m));
        });

        setOnlineUsers(payload.userIds);
        setAllUserMessages(normalizedHistory);
        setError(null);

        // Fetch unread counts once on join
        try {
          const entries = await Promise.all(payload.userIds.map(async id => {
            try {
              const res = await api.getUnreadCount(id, 'admin', accessToken || '');
              return [id, res?.data?.unreadCount || 0];
            } catch { return [id, 0]; }
          }));
          setUnreadCounts(Object.fromEntries(entries));
        } catch {
          // ignore
        }
      } else {
        setError(payload.reason || 'Admin join bi tu choi');
      }
    });

    socket.on('user:joined', (payload: unknown) => {
      const newUserId = typeof payload === 'string' ? payload : (payload as { userId?: string })?.userId;

      if (newUserId) {
        // Đẩy user mới lên đầu và lọc bỏ ID trùng nếu có
        setOnlineUsers((prev) => [newUserId, ...prev.filter((id) => id !== newUserId)]);
        
        // Fetch unread count for the newly joined user
        if (accessToken) {
          api.getUnreadCount(newUserId, 'admin', accessToken)
            .then(res => {
              setUnreadCounts(prev => ({ ...prev, [newUserId]: res?.data?.unreadCount || 0 }));
            }).catch(() => {});
        }
      }
    });

    socket.on('user:left', (payload: { userId: string }) => {
      if (payload?.userId) {
        setOnlineUsers((prev) => prev.filter((id) => id !== payload.userId));
      }
    });

    socket.on('message:new', (message: Message) => {
      setAllUserMessages((prevAllMessages) => {
        const targetUserId = message.sender === 'admin' ? message.receiver : message.sender;
        const currentMessages = prevAllMessages[targetUserId] || [];
        return { ...prevAllMessages, [targetUserId]: upsertMessage(currentMessages, message) };
      });

      if (message.sender !== 'admin' && message.sender !== 'system') {
        // Luôn đưa người gửi tin nhắn mới nhất lên đầu danh sách
        setOnlineUsers((prev) => [message.sender, ...prev.filter((id) => id !== message.sender)]);

        const sender = message.sender;
        if (selectedUserIdRef.current === sender) {
          // If admin is currently viewing this user, mark as read on server and clear unread count
          (async () => {
            try {
              if (accessToken) await api.markRead(sender, 'admin', accessToken);
            } catch {
              // ignore
            }
            setUnreadCounts(prev => ({ ...prev, [sender]: 0 }));
          })();
        } else {
          setUnreadCounts(prev => ({ ...prev, [sender]: (prev[sender] || 0) + 1 }));
        }
      }
    });

    socket.on('message:send:ack', (payload: any) => {
      if (payload.ok && payload.message) {
        const targetUserId = payload.message.receiver;
        setAllUserMessages(prev => {
          const current = prev[targetUserId] || [];
          return { 
            ...prev, 
            [targetUserId]: upsertMessage(current, { 
              ...payload.message, 
              tempId: payload.tempId, 
              status: 'sent' 
            }) 
          };
        });
      }
    });

    socket.on('message:uploading', (payload: any) => {
      const targetUserId = payload.receiver || selectedUserIdRef.current;
      if (!targetUserId) return;
      setAllUserMessages((prev) => {
        const current = prev[targetUserId] || [];
        return {
          ...prev,
          [targetUserId]: upsertMessage(current, {
            tempId: payload.tempId,
            status: 'sending',
            fileName: payload.fileName,
          })
        };
      });
    });

    socket.on('message:upload:error', (payload: any) => {
      setError(mapMessageError(payload.reason));
      const targetUserId = payload.receiver || selectedUserIdRef.current;
      if (!targetUserId) return;
      setAllUserMessages((prev) => {
        const current = prev[targetUserId] || [];
        return {
          ...prev,
          [targetUserId]: upsertMessage(current, {
            tempId: payload.tempId,
            status: 'failed'
          })
        };
      });
    });

    socket.on('message:error', (payload: SocketPayload) => {
      setError(mapMessageError(payload.reason));
    });

    socket.on('call:incoming', (payload: any) => {
      console.log('[admin] call:incoming', { callId: payload.callId, caller: payload.caller });
      setIncomingCalls(prev => {
        if (prev.some(c => c.callId === payload.callId) || activeCallsRef.current.some(c => c.callId === payload.callId)) {
          return prev;
        }
        return [...prev, {
          callId: payload.callId,
          caller: payload.caller,
          remoteStream: null,
          status: 'incoming' as const,
          pc: null,
          offer: payload.offer
        }];
      });
      setCallStatus('ringing');
      setIsVideoCallModalVisible(true); // Auto-open modal on incoming call
      playRingtone();
    });
    socket.on('call:accepted', async (payload: any) => {
      // eslint-disable-next-line no-console
      console.log('[admin] call:accepted', payload.callId, payload.answer);
      const pc = pcMapRef.current.get(payload.callId);
      if (pc && payload.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          setActiveCalls(prev => prev.map(c => c.callId === payload.callId ? { ...c, status: 'ongoing' as const } : c));
          setCallStatus('ongoing');
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    });
    socket.on('call:ice-candidate', async (payload: any) => {
      const pc = pcMapRef.current.get(payload.callId);
      if (pc && payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.error);
      }
    });
    // Events received from the other party via backend
    socket.on('call:error', (payload: any) => {
      console.log('[admin] call:error', payload);
      setError(payload?.reason || 'Call error');
      if (payload.callId) cleanupCall(payload.callId);
    });
    socket.on('call:rejected', (payload: any) => {
      console.log('[admin] call:rejected', payload);
      if (payload?.callId) cleanupCall(payload.callId);
    });
    socket.on('call:cancelled', (payload: any) => {
      console.log('[admin] call:cancelled', payload);
      if (payload?.callId) cleanupCall(payload.callId);
    });
    socket.on('call:ended', (payload: any) => {
      console.log('[admin] call:ended', payload);
      if (payload?.callId) cleanupCall(payload.callId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const handleSetSelectedFiles = (files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`File ${file.name} vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB`);
        return;
      }
    }

    setError(null);
    setSelectedFiles(files);
  };

  const clearAttachment = () => {
    setSelectedFiles([]);
  };

  const startSession = async () => {
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu admin');
      return;
    }

    if (!captchaToken) {
      setError('Vui lòng xác thực reCAPTCHA');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.adminLogin(password.trim(), captchaToken);
      const token = data.data.accessToken;
      const refresh = data.data.refreshToken;
      if (!token || !refresh) {
        throw new Error('Không nhận được accessToken hoặc refreshToken');
      }

      setAccessToken(token);
      setRefreshToken(refresh);
      setUserId('admin');
      setSessionNickname('Administrator');
      saveAuth(token, refresh, 'Administrator');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStatus('error');
    }
  };

  const sendMessage = async () => {
    const content = draftRef.current.trim();
    const receiver = selectedUserIdRef.current;
    const files = selectedFilesRef.current;

    if (!socketRef.current?.connected || isSendingRef.current || !receiver || (!content && files.length === 0)) {
      return;
    }

    const tempId = createCallId(); // Sử dụng helper đã có để tạo UUID
    isSendingRef.current = true;
    setIsSending(true);

    const socketFiles: SocketFilePayload[] = [];
    const localAttachments: any[] = [];

    try {
      for (const file of files) {
        const base64 = await toBase64(file);
        const url = URL.createObjectURL(file);
        socketFiles.push({
          data: base64,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
        });
        localAttachments.push({
          url,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          type: isImageFile(file) ? 'image' : 'file'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc file đính kèm');
      setIsSending(false);
      isSendingRef.current = false;
      return;
    }

    draftRef.current = '';
    setDraft('');
    setSelectedFiles([]);
    
    const newMessage: any = {
      tempId,
      content: content || null, // Đảm bảo không có logic: content || `Đã gửi ${files.length} file`
      sender: 'admin',
      receiver,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachments: localAttachments,
      ...(localAttachments.length > 0
        ? {
            attachmentType: localAttachments[0].type,
            imageURL: localAttachments[0].type === 'image' ? localAttachments[0].url : undefined,
            fileURL: localAttachments[0].url,
            fileDownloadURL: localAttachments[0].url,
            fileName: localAttachments[0].name,
            fileMimeType: localAttachments[0].mimeType,
            fileSize: localAttachments[0].size,
          }
        : {}),
    };

    setAllUserMessages((prevAllMessages) => {
      const currentMessages = prevAllMessages[receiver] || [];
      return { ...prevAllMessages, [receiver]: upsertMessage(currentMessages, newMessage) };
    });

    socketRef.current.emit('message:send', {
      tempId,
      content: content || null,
      receiver,
      files: socketFiles,
    });

    setIsSending(false);
    isSendingRef.current = false;
  };

  const selectUser = (userId: string | null) => {
    setSelectedUserId(userId);
    if (!userId) return;

    (async () => {
      try {
        if (accessToken) await api.markRead(userId, 'admin', accessToken);
      } catch {
        // ignore
      }
      setUnreadCounts(prev => ({ ...prev, [userId]: 0 }));

      // update local messages to mark as read where receiver is admin
      setAllUserMessages(prev => {
        const conv = prev[userId] || [];
        const updated = conv.map(m => (m.receiver === 'admin' ? { ...m, isRead: true } : m));
        return { ...prev, [userId]: updated };
      });
    })();
  };

  return {
    password,
    sessionNickname,
    status,
    socketConnected,
    userId,
    onlineUsers,
    selectedUserId,
    messages,
    draft,
    selectedFiles,
    isSending,
    error,
    canSend,
    statusText,
    videoCall: {
      status: callStatus,
      activeCalls,
      incomingCalls,
      localStream,
      error,
      canStartCall: socketConnected && !!selectedUserId && selectedUserId !== 'admin',
      isVideoCallModalVisible,
      startCall: (receiver?: string) => startCall(receiver || selectedUserIdRef.current || ''),
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleVideoCallModal: () => setIsVideoCallModalVisible(prev => !prev),
    },
    setPassword,
    setDraft,
    setSelectedFiles: handleSetSelectedFiles,
    clearAttachment,
    setSelectedUserId: selectUser,
    setCaptchaToken,
    unreadCounts,
    startSession,
    sendMessage,
    resetSession,
  };
};

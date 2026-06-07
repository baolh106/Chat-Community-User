import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../utils/socket';
import { api } from '../utils/api';
import type { Message, SocketPayload, ChatStatus, SocketFilePayload } from '../types';

const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

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

const isImageFile = (file: File) => file.type.startsWith('image/');

const mapMessageError = (reason?: string) => {
  if (reason === 'file_too_large') return `File vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB`;
  if (reason === 'invalid_file_payload') return 'File đính kèm không hợp lệ';
  if (reason === 'message content or file is required') return 'Nhập nội dung hoặc chọn file để gửi';
  if (reason === 'invalid_payload') return 'Thiếu người nhận tin nhắn';
  if (reason === 'unauthorized') return 'Phiên đăng nhập không hợp lệ';
  return reason || 'Gửi message thất bại';
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createCallId = () => generateUUID();

const upsertMessage = (messages: Message[], nextMessage: any) => {
  const index = messages.findIndex(m => 
    (nextMessage.id && (m as any).id === nextMessage.id) ||
    (nextMessage.tempId && (m as any).tempId === nextMessage.tempId) ||
    (m.sender === nextMessage.sender && m.content === nextMessage.content && 
    Math.abs(new Date(m.createdAt).getTime() - new Date(nextMessage.createdAt).getTime()) < 2000)
  );

  if (index >= 0) {
    const next = [...messages];
    next[index] = { ...next[index], ...nextMessage };
    return next;
  }

  // Nếu không tìm thấy và tin nhắn mới thiếu thông tin cơ bản (chỉ là update status)
  // thì không thêm mới để tránh tạo ra tin nhắn "ma"
  if (!nextMessage.sender || !nextMessage.createdAt) {
    return messages;
  }

  return [...messages, nextMessage];
};

export interface VideoCallState {
  status: 'idle' | 'calling' | 'incoming' | 'ongoing';
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

interface UseChatReturn {
  nickname: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  messages: Message[];
  draft: string;
  selectedFile: File | null;
  isSending: boolean;
  error: string | null;
  canSend: boolean;
  statusText: string;
  videoCall: VideoCallState;
  setNickname: (value: string) => void;
  setCaptchaToken: (token: string | null) => void;
  setDraft: (value: string) => void;
  setSelectedFile: (file: File | null) => void;
  clearAttachment: () => void;
  startSession: () => Promise<void>;
  sendMessage: () => Promise<void>;
  resetSession: () => void;
}

export const useChat = (): UseChatReturn => {
  const [nickname, setNickname] = useState('');
  const [sessionNickname, setSessionNickname] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedFileState, setSelectedFileState] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video Call States
  const [callStatus, setCallStatus] = useState<VideoCallState['status']>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const selectedFileRef = useRef<File | null>(selectedFileState);
  const isSendingRef = useRef(isSending);
  const userIdRef = useRef(userId);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerNameRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const ringAudioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);
  const ringOscillatorRef2 = useRef<OscillatorNode | null>(null);
  const ringGainRef = useRef<GainNode | null>(null);
  const ringGainRef2 = useRef<GainNode | null>(null);
  const ringTimerRef = useRef<number | null>(null);

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

      // Ring for 1400ms (1.4 seconds)
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
    // Ring 1400ms on, 100ms off = 1500ms total interval (Near continuous)
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
  const refreshAttemptedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const canSend = Boolean(
    socketConnected && userId && !isSending && (draft.trim().length > 0 || selectedFileState)
  );

  const statusText = useMemo(() => {
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Connected';
    if (status === 'disconnected') return 'Disconnected';
    if (status === 'error') return 'Connection error';
    return 'Not logged in';
  }, [status]);

  const STORAGE_KEY = 'user_chat_auth';

  const saveAuth = (accessTokenValue: string, refreshTokenValue: string, nicknameValue: string, userIdValue: string | null, messagesValue: Message[]) => {
    const payload = {
      accessToken: accessTokenValue,
      refreshToken: refreshTokenValue,
      sessionNickname: nicknameValue,
      userId: userIdValue,
      messages: messagesValue,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const clearStoredAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const tryRefreshSession = async () => {
    if (!refreshToken) {
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
        saveAuth(token, refreshedRefreshToken, sessionNickname || nickname, userId, messages);
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

  // Tự động lưu session khi có thay đổi về tin nhắn, userId hoặc tokens
  useEffect(() => {
    if (accessToken && refreshToken && sessionNickname) {
      saveAuth(accessToken, refreshToken, sessionNickname, userId, messages);
    }
  }, [accessToken, refreshToken, sessionNickname, userId, messages]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        accessToken: string;
        refreshToken: string;
        sessionNickname?: string;
        userId?: string;
        messages?: Message[];
      };
      if (parsed.accessToken && parsed.refreshToken) {
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken);
        setSessionNickname(parsed.sessionNickname || '');
        if (parsed.userId) setUserId(parsed.userId);
        if (parsed.messages) setMessages(parsed.messages);
      }
    } catch {
      clearStoredAuth();
    }
  }, []);

  useEffect(() => {
    refreshAttemptedRef.current = false;
  }, [accessToken]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    selectedFileRef.current = selectedFileState;
  }, [selectedFileState]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    callIdRef.current = null;
    setPeerName(null);
    peerNameRef.current = null;
    pendingOfferRef.current = null;
    stopRingtone();
  };

  const isAllowedReceiver = (receiver: string) => receiver === 'admin';

  const startCall = async (receiver: string = 'admin') => {
    if (!isAllowedReceiver(receiver)) {
      setError('User chỉ được gọi tới admin');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // eslint-disable-next-line no-console
      console.log('[user] acquired local stream', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));
      setLocalStream(stream);
      localStreamRef.current = stream;
      setCallStatus('calling');
      setPeerName(receiver);
      peerNameRef.current = receiver;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        const s = event.streams[0];
        // eslint-disable-next-line no-console
        console.log('[user] pc.ontrack', s, 'tracks=', s?.getTracks().map(t=>({kind:t.kind, id:t.id})));
        setRemoteStream(s);
      };
      pc.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current) {
          socketRef.current?.emit('call:ice-candidate', {
            callId: callIdRef.current,
            receiver,
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (!callIdRef.current) callIdRef.current = createCallId();
      const invitePayload = { callId: callIdRef.current, receiver, mediaType: 'video', offer };
      console.log('[user] emit call:invite', invitePayload);
      socketRef.current?.emit('call:invite', invitePayload, (ack: any) => {
        if (ack?.ok && ack.callId) {
          callIdRef.current = ack.callId;
        }
      });
    } catch (err) {
      setError('Không thể truy cập camera/micro');
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!pendingOfferRef.current || !callIdRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // eslint-disable-next-line no-console
      console.log('[user] acquired local stream for accept', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
          const s = event.streams[0];
          // eslint-disable-next-line no-console
          console.log('[user] pc.ontrack (accept)', s, 'tracks=', s?.getTracks().map(t=>({kind:t.kind, id:t.id})));
          setRemoteStream(s);
      };
      pc.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current && peerNameRef.current) {
          socketRef.current?.emit('call:ice-candidate', {
            callId: callIdRef.current,
            receiver: peerNameRef.current,
            candidate: event.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('call:accept', {
        callId: callIdRef.current,
        receiver: peerNameRef.current || 'admin',
        answer,
      });
      stopRingtone();
      setCallStatus('ongoing');
    } catch (err) {
      setError('Lỗi khi chấp nhận cuộc gọi');
      cleanupCall();
    }
  };

  const rejectCall = () => {
    const payload = { callId: callIdRef.current, receiver: peerNameRef.current || 'admin' };
    socketRef.current?.emit('call:reject', payload);
    cleanupCall();
  };

  const cancelCall = () => {
    const payload = { callId: callIdRef.current, receiver: peerNameRef.current || 'admin' };
    socketRef.current?.emit('call:cancel', payload);
    cleanupCall();
  };

  const endCall = () => {
    const payload = { callId: callIdRef.current, receiver: peerNameRef.current || 'admin' };
    socketRef.current?.emit('call:end', payload);
    cleanupCall();
  };

  useEffect(() => {
    if (!accessToken) return;

    const socket = createSocket(accessToken);
    socketRef.current = socket;
    setStatus('connecting');

    const handleConnect = () => {
      console.log('Socket connected, emitting user:join');
      setSocketConnected(true);
      setStatus('connected');
      socket.emit('user:join');
    };

    // Đăng ký listener trước
    socket.on('connect', handleConnect);

    // Nếu đã kết nối rồi (do cache hoặc kết nối cực nhanh) thì gọi trực tiếp
    if (socket.connected) {
      handleConnect();
    }

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setStatus('disconnected');
      cleanupCall();
    });

    socket.on('connect_error', async (err: Error) => {
      console.error('connect_error', err);
      const message = err?.message || '';
      const isAuthError = /unauthorized|token|expired|jwt|authentication/i.test(message);

      if (isAuthError && refreshToken && !refreshAttemptedRef.current) {
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
      cleanupCall();
    });

    socket.on('user:joined', (payload: SocketPayload) => {
      if (payload.ok && payload.userId) {
        const joinedUserId = payload.userId;
        setUserId(joinedUserId);
        setError(null);
        setMessages((prev) => {
          // Chỉ thêm tin nhắn chào mừng nếu đây là lần đầu join (chưa có lịch sử)
          if (prev.length > 0) return prev;
          return [
            {
              content: `Welcome ${joinedUserId}`,
              sender: 'system',
              receiver: joinedUserId,
              createdAt: new Date().toISOString(),
            },
          ];
        });
      }
    });

    socket.on('user:join_denied', (payload: SocketPayload) => {
      setError(payload.reason || 'Join bi tu choi');
    });

    socket.on('message:new', (message: Message) => {
      setMessages((prev) => upsertMessage(prev, message));
    });

    socket.on('message:send:ack', (payload: any) => {
      if (payload.ok && payload.message) {
        setMessages((prev) => upsertMessage(prev, { 
          ...payload.message, 
          tempId: payload.tempId, 
          status: 'sent' 
        }));
      }
    });

    socket.on('message:uploading', (payload: any) => {
      setMessages((prev) => upsertMessage(prev, {
        tempId: payload.tempId,
        status: 'sending',
        fileName: payload.fileName,
      }));
    });

    socket.on('message:upload:error', (payload: any) => {
      setError(mapMessageError(payload.reason));
      setMessages((prev) => upsertMessage(prev, {
        tempId: payload.tempId,
        status: 'failed'
      }));
    });

    socket.on('message:error', (payload: SocketPayload) => {
      setError(mapMessageError(payload.reason));
    });

    socket.on('call:incoming', (payload: any) => {
      setCallStatus('incoming');
      setPeerName(payload.caller);
      peerNameRef.current = payload.caller;
      callIdRef.current = payload.callId;
      pendingOfferRef.current = payload.offer;
      playRingtone();
    });

    socket.on('call:accepted', async (payload: any) => {
      if (pcRef.current && payload.answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        setCallStatus('ongoing');
      }
    });

    socket.on('call:ice-candidate', async (payload: any) => {
      if (pcRef.current && payload.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.error);
      }
    });

    // Events received from the other party via backend
    socket.on('call:error', (payload: any) => {
      setError(payload?.reason || 'Call error');
      cleanupCall();
    });
    socket.on('call:rejected', () => {
      cleanupCall();
    });
    socket.on('call:cancelled', () => {
      cleanupCall();
    });
    socket.on('call:cancel', () => {
      cleanupCall();
    });
    socket.on('call:ended', () => {
      cleanupCall();
    });
    socket.on('call:end', () => {
      cleanupCall();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const setSelectedFile = (file: File | null) => {
    if (file && file.size > MAX_ATTACHMENT_SIZE) {
      setError(`File vuot qua gioi han ${MAX_ATTACHMENT_SIZE_MB}MB`);
      return;
    }

    setError(null);
    setSelectedFileState(file);
  };

  const clearAttachment = () => {
    setSelectedFileState(null);
  };

  const startSession = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Vui lòng nhập nickname');
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 15) {
      setError('Nickname phải có từ 2 đến 15 ký tự');
      return;
    }

    if (!captchaToken) {
      setError('Vui lòng xác thực reCAPTCHA');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.startSession(nickname.trim(), captchaToken);
      const token = data.data.accessToken;
      const refresh = data.data.refreshToken;
      if (!token || !refresh) {
      throw new Error('Không nhận được accessToken hoặc refreshToken');
      }

      setAccessToken(token);
      setRefreshToken(refresh);
      setSessionNickname(nickname.trim());
      saveAuth(token, refresh, nickname.trim(), null, []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStatus('error');
    }
  };

  const sendMessage = async () => {
    const content = draftRef.current.trim();
    const file = selectedFileRef.current;

    if (!socketRef.current?.connected || isSendingRef.current || (!content && !file)) return;

    const tempId = generateUUID();
    isSendingRef.current = true;
    setIsSending(true);

    let socketFile: SocketFilePayload | undefined;
    let localFileURL: string | undefined;

    try {
      if (file) {
        socketFile = {
          data: await toBase64(file),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
        };
        localFileURL = URL.createObjectURL(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc file đính kèm');
      setIsSending(false);
      isSendingRef.current = false;
      return;
    }

    draftRef.current = '';
    setDraft('');
    selectedFileRef.current = null;
    setSelectedFileState(null);
    
    const newMessage: any = {
      tempId,
      content: content || null,
      sender: userId || 'user',
      receiver: 'admin',
      createdAt: new Date().toISOString(),
      status: 'sending',
      ...(file
        ? {
            attachmentType: isImageFile(file) ? 'image' : 'file',
            imageURL: isImageFile(file) ? localFileURL : undefined,
            fileURL: localFileURL,
            fileDownloadURL: localFileURL,
            fileName: file.name,
            fileMimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
          }
        : {}),
    };

    setMessages((prev) => upsertMessage(prev, newMessage));

    socketRef.current.emit('message:send', {
      tempId,
      content: content || null,
      receiver: 'admin',
      ...(socketFile ? { file: socketFile } : {}),
    });

    setIsSending(false);
    isSendingRef.current = false;
  };

  const resetSession = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setSessionNickname('');
    setUserId(null);
    setMessages([]);
    setSelectedFileState(null);
    setIsSending(false);
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearStoredAuth();
  };

  return {
    nickname,
    sessionNickname,
    status,
    socketConnected,
    userId,
    messages,
    draft,
    selectedFile: selectedFileState,
    isSending,
    error,
    canSend,
    statusText,
    videoCall: {
      status: callStatus,
      peerName,
      localStream,
      remoteStream,
      error,
      canStartCall: socketConnected && !!userId,
      startCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
    },
    setNickname,
    setCaptchaToken,
    setDraft,
    setSelectedFile,
    clearAttachment,
    startSession,
    sendMessage,
    resetSession,
  };
};

import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../utils/socket';
import { api } from '../utils/api';
import type { Message, SocketPayload, ChatStatus } from '../types';

interface UseChatReturn {
  // State
  nickname: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  messages: Message[];
  draft: string;
  error: string | null;
  canSend: boolean;
  statusText: string;

  // Actions
  setNickname: (value: string) => void;
  setDraft: (value: string) => void;
  startSession: () => Promise<void>;
  sendMessage: () => void;
  resetSession: () => void;
}

export const useChat = (): UseChatReturn => {
  const [nickname, setNickname] = useState('');
  const [sessionNickname, setSessionNickname] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const userIdRef = useRef(userId);

  const canSend = Boolean(socketConnected && userId && draft.trim().length > 0);

  const statusText = useMemo(() => {
    if (status === 'connecting') return 'Đang kết nối...';
    if (status === 'connected') return 'Đã kết nối';
    if (status === 'disconnected') return 'Mất kết nối';
    if (status === 'error') return 'Lỗi kết nối';
    return 'Chưa đăng nhập';
  }, [status]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = createSocket(accessToken);
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setSocketConnected(true);
      setStatus('connected');
      socket.emit('user:join');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setStatus('disconnected');
    });

    socket.on('connect_error', (err: Error) => {
      console.error('connect_error', err);
      setError('Fail connection.');
      setStatus('error');
    });

    socket.on('user:joined', (payload: SocketPayload) => {
      if (payload.ok && payload.userId) {
        const joinedUserId = payload.userId;
        setUserId(joinedUserId);
        setError(null);
        setMessages((prev) => [
          ...prev,
          {
            content: `Welcome ${joinedUserId}`,
            sender: 'system',
            receiver: joinedUserId,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    });

    socket.on('user:join_denied', (payload: SocketPayload) => {
      setError(payload.reason || 'Join bị từ chối');
    });

    socket.on('message:new', (message: Message) => {
      // Bỏ qua nếu tin nhắn do chính mình gửi (đã được thêm ở sendMessage)
      if (message.sender === userIdRef.current) return;

      setMessages((prev) => [...prev, message]);
    });

    socket.on('message:sent', () => {
      // Server đã nhận được tin nhắn
    });

    socket.on('message:error', (payload: SocketPayload) => {
      setError(payload.reason || 'Gửi message thất bại');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const startSession = async () => {
    if (!nickname.trim()) {
      setError('Vui lòng nhập nickname');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.startSession(nickname.trim());
      const token = data.data.accessToken;
      if (!token) {
        throw new Error('Không nhận được accessToken');
      }

      setAccessToken(token);
      setSessionNickname(nickname.trim());
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStatus('error');
    }
  };

  const sendMessage = () => {
    const content = draftRef.current.trim();
    if (!socketRef.current?.connected || !content) return;

    // Guard: Xóa ngay lập tức để tránh gửi lặp khi render chưa kịp đáp ứng
    draftRef.current = '';
    setDraft('');

    socketRef.current.emit('message:send', {
      content,
      receiver: 'admin',
    });

    // Optimistic UI: Hiển thị ngay lập tức
    setMessages((prev) => [
      ...prev,
      {
        content,
        sender: userId || 'user',
        receiver: 'admin',
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft('');
  };

  const resetSession = () => {
    setAccessToken(null);
    setSessionNickname('');
    setUserId(null);
    setMessages([]);
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  return {
    // State
    nickname,
    sessionNickname,
    status,
    socketConnected,
    userId,
    messages,
    draft,
    error,
    canSend,
    statusText,

    // Actions
    setNickname,
    setDraft,
    startSession,
    sendMessage,
    resetSession,
  };
};

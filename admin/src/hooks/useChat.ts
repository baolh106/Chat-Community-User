import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../utils/socket';
import { api } from '../utils/api';
import type { Message, SocketPayload, ChatStatus } from '../types';

interface UseChatReturn {
  // State
  password: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  onlineUsers: string[];
  selectedUserId: string | null;
  messages: Message[];
  draft: string;
  error: string | null;
  canSend: boolean;
  statusText: string;

  // Actions
  setPassword: (value: string) => void;
  setDraft: (value: string) => void;
  setSelectedUserId: (userId: string | null) => void;
  startSession: () => Promise<void>;
  sendMessage: () => void;
  resetSession: () => void;
}

export const useChat = (): UseChatReturn => {
  const [password, setPassword] = useState('');
  const [sessionNickname, setSessionNickname] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allUserMessages, setAllUserMessages] = useState<Record<string, Message[]>>({}); // Stores messages for all online users
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const userIdRef = useRef(userId);
  const selectedUserIdRef = useRef(selectedUserId);

  const canSend = Boolean(socketConnected && selectedUserId && draft.trim().length > 0);

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
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  // Derived state: messages for the currently selected user
  const messages = useMemo(() => {
    return selectedUserId ? allUserMessages[selectedUserId] || [] : [];
  }, [allUserMessages, selectedUserId]);

  // Automatically select the first user when onlineUsers are loaded or change
  // if no user is currently selected.
  // This helps ensure Admin always has someone to chat with by default.
  useEffect(() => {
    if (onlineUsers.length > 0 && selectedUserId === null) {
      setSelectedUserId(onlineUsers[0]);
    }
  }, [onlineUsers, selectedUserId]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = createSocket(accessToken);
    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => {
      setSocketConnected(true);
      setStatus('connected');
      socket.emit('admin:join');
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

    socket.on('admin:joined', (payload: { ok: boolean; userIds?: string[]; history?: Record<string, Message[]>; reason?: string }) => {
      if (payload.ok && payload.userIds) {
        setOnlineUsers(payload.userIds);
        setAllUserMessages(payload.history || {}); // Initialize with historical messages for all users
        setError(null);
      } else {
        setError(payload.reason || 'Admin join bị từ chối');
      }
    });

    // Lắng nghe khi có User mới join vào hệ thống để cập nhật danh sách realtime
    socket.on('user:joined', (payload: any) => {
      // Chấp nhận cả object {ok, userId} hoặc chỉ userId để tương thích với nhiều cách emit từ backend
      const newUserId = typeof payload === 'string' ? payload : payload?.userId;
      
      if (newUserId) {
        setOnlineUsers((prev) => {
          if (prev.includes(newUserId)) return prev;
          // Đưa user mới lên đầu danh sách để admin thấy ngay "box" mới
          return [newUserId, ...prev];
        });
      }
    });

    // Lắng nghe khi User thoát hoặc mất kết nối để xóa khỏi danh sách
    socket.on('user:left', (payload: { userId: string }) => {
      if (payload?.userId) {
        setOnlineUsers((prev) => prev.filter(id => id !== payload.userId));
      }
    });

    socket.on('message:new', (message: Message) => {
      // Bỏ qua nếu tin nhắn do chính mình gửi (đã được thêm ở sendMessage bằng Optimistic UI)
      if (message.sender === userIdRef.current || message.sender === 'admin') return;
      
      setAllUserMessages((prevAllMessages) => {
        const targetUserId = message.sender; // Message from a user
        const currentMessages = prevAllMessages[targetUserId] || [];

        // Kiểm tra tránh trùng lặp tin nhắn nếu server echo hoặc socket bị lặp event
        const isDuplicate = currentMessages.some(m => 
          m.createdAt === message.createdAt && 
          m.sender === message.sender && 
          m.content === message.content
        );
        if (isDuplicate) return prevAllMessages;
        return { ...prevAllMessages, [targetUserId]: [...currentMessages, message] };
      });

      // Nếu tin nhắn đến từ một user mới (không phải admin/system), tự động thêm vào danh sách online
      if (message.sender !== 'admin' && message.sender !== 'system') {
        setOnlineUsers((prev) => {
          if (!prev.includes(message.sender)) {
            return [message.sender, ...prev]; // Add new user to top
          }
          return prev;
        });
      }
    });

    socket.on('message:sent', () => {
      // Tin nhắn đã được xác nhận gửi thành công từ server
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
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu admin');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.adminLogin(password.trim());
      const token = data.data.accessToken;
      if (!token) {
        throw new Error('Không nhận được accessToken');
      }

      setAccessToken(token);
      // Admin thường có định danh cố định hoặc từ token payload
      setUserId('admin');
      setSessionNickname('Administrator'); 
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStatus('error');
    }
  };

  const sendMessage = () => {
    const content = draftRef.current.trim();
    const receiver = selectedUserIdRef.current;

    if (!socketRef.current?.connected || !content || !receiver) {
      return;
    }

    // Xóa draft ngay lập tức ở cả Ref và State để chặn các lần gọi lặp lại (do double-click hoặc Enter)
    draftRef.current = '';
    setDraft('');

    socketRef.current.emit('message:send', {
      content,
      receiver,
    });

    // Optimistic UI: Hiển thị ngay lập tức để trải nghiệm mượt mà
    setAllUserMessages((prevAllMessages) => {
      const currentMessages = prevAllMessages[receiver] || [];
      return {
        ...prevAllMessages,
        [receiver]: [
          ...currentMessages,
          {
            content,
            sender: 'admin',
            receiver,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const resetSession = () => {
    setAccessToken(null);
    setSessionNickname('');
    setUserId(null);
    setOnlineUsers([]);
    setSelectedUserId(null);
    setAllUserMessages({}); // Clear all messages
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  return {
    // State
    password,
    sessionNickname,
    status,
    socketConnected,
    userId,
    onlineUsers,
    selectedUserId,
    messages,
    draft,
    error,
    canSend,
    statusText,

    // Actions
    setPassword,
    setDraft,
    setSelectedUserId,
    startSession,
    sendMessage,
    resetSession,
  };
};

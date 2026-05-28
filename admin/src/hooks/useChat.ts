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
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isImageFile = (file: File) => file.type.startsWith('image/');

const mapMessageError = (reason?: string) => {
  if (reason === 'file_too_large') return `File vuot qua gioi han ${MAX_ATTACHMENT_SIZE_MB}MB`;
  if (reason === 'invalid_file_payload') return 'File dinh kem khong hop le';
  if (reason === 'message content or file is required') return 'Nhap noi dung hoac chon file de gui';
  if (reason === 'invalid_payload') return 'Thieu nguoi nhan tin nhan';
  if (reason === 'unauthorized') return 'Phien dang nhap khong hop le';
  return reason || 'Gui message that bai';
};

const upsertMessage = (messages: Message[], nextMessage: Message) => {
  const duplicateIndex = messages.findIndex(
    (message) =>
      message.createdAt === nextMessage.createdAt &&
      message.sender === nextMessage.sender &&
      message.receiver === nextMessage.receiver
  );
  if (duplicateIndex >= 0) {
    const next = [...messages];
    next[duplicateIndex] = nextMessage;
    return next;
  }

  let optimisticIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.sender === nextMessage.sender &&
      message.receiver === nextMessage.receiver &&
      message.content === nextMessage.content &&
      message.fileName === nextMessage.fileName
    ) {
      optimisticIndex = index;
      break;
    }
  }
  if (optimisticIndex >= 0 && messages[optimisticIndex].fileURL?.startsWith('blob:')) {
    const next = [...messages];
    next[optimisticIndex] = nextMessage;
    return next;
  }

  return [...messages, nextMessage];
};

interface UseChatReturn {
  password: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  onlineUsers: string[];
  selectedUserId: string | null;
  messages: Message[];
  draft: string;
  selectedFile: File | null;
  isSending: boolean;
  error: string | null;
  canSend: boolean;
  statusText: string;
  setPassword: (value: string) => void;
  setDraft: (value: string) => void;
  setSelectedFile: (file: File | null) => void;
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
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allUserMessages, setAllUserMessages] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState('');
  const [selectedFileState, setSelectedFileState] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const selectedFileRef = useRef<File | null>(selectedFileState);
  const isSendingRef = useRef(isSending);
  const userIdRef = useRef(userId);
  const selectedUserIdRef = useRef(selectedUserId);

  const canSend = Boolean(
    socketConnected && selectedUserId && !isSending && (draft.trim().length > 0 || selectedFileState)
  );

  const statusText = useMemo(() => {
    if (status === 'connecting') return 'Dang ket noi...';
    if (status === 'connected') return 'Da ket noi';
    if (status === 'disconnected') return 'Mat ket noi';
    if (status === 'error') return 'Loi ket noi';
    return 'Chua dang nhap';
  }, [status]);

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

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const messages = useMemo(() => {
    return selectedUserId ? allUserMessages[selectedUserId] || [] : [];
  }, [allUserMessages, selectedUserId]);

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
        setAllUserMessages(payload.history || {});
        setError(null);
      } else {
        setError(payload.reason || 'Admin join bi tu choi');
      }
    });

    socket.on('user:joined', (payload: unknown) => {
      const newUserId = typeof payload === 'string' ? payload : (payload as { userId?: string })?.userId;

      if (newUserId) {
        setOnlineUsers((prev) => {
          if (prev.includes(newUserId)) return prev;
          return [newUserId, ...prev];
        });
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
        setOnlineUsers((prev) => {
          if (!prev.includes(message.sender)) {
            return [message.sender, ...prev];
          }
          return prev;
        });
      }
    });

    socket.on('message:sent', () => {
      // Server accepted the message.
    });

    socket.on('message:error', (payload: SocketPayload) => {
      setError(mapMessageError(payload.reason));
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
    if (!password.trim()) {
      setError('Vui long nhap mat khau admin');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.adminLogin(password.trim());
      const token = data.data.accessToken;
      if (!token) {
        throw new Error('Khong nhan duoc accessToken');
      }

      setAccessToken(token);
      setUserId('admin');
      setSessionNickname('Administrator');
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loi khong xac dinh');
      setStatus('error');
    }
  };

  const sendMessage = async () => {
    const content = draftRef.current.trim();
    const receiver = selectedUserIdRef.current;
    const file = selectedFileRef.current;

    if (!socketRef.current?.connected || isSendingRef.current || !receiver || (!content && !file)) {
      return;
    }

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
      setError(err instanceof Error ? err.message : 'Khong the doc file dinh kem');
      setIsSending(false);
      isSendingRef.current = false;
      return;
    }

    draftRef.current = '';
    setDraft('');
    selectedFileRef.current = null;
    setSelectedFileState(null);

    socketRef.current.emit('message:send', {
      content: content || null,
      receiver,
      ...(socketFile ? { file: socketFile } : {}),
    });

    setAllUserMessages((prevAllMessages) => {
      const currentMessages = prevAllMessages[receiver] || [];
      return {
        ...prevAllMessages,
        [receiver]: [
          ...currentMessages,
          {
            content: content || null,
            sender: 'admin',
            receiver,
            createdAt: new Date().toISOString(),
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
          },
        ],
      };
    });

    setIsSending(false);
    isSendingRef.current = false;
  };

  const resetSession = () => {
    setAccessToken(null);
    setSessionNickname('');
    setUserId(null);
    setOnlineUsers([]);
    setSelectedUserId(null);
    setAllUserMessages({});
    setSelectedFileState(null);
    setIsSending(false);
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
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
    selectedFile: selectedFileState,
    isSending,
    error,
    canSend,
    statusText,
    setPassword,
    setDraft,
    setSelectedFile,
    clearAttachment,
    setSelectedUserId,
    startSession,
    sendMessage,
    resetSession,
  };
};

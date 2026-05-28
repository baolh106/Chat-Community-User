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
  setNickname: (value: string) => void;
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
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [socketConnected, setSocketConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedFileState, setSelectedFileState] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const draftRef = useRef(draft);
  const selectedFileRef = useRef<File | null>(selectedFileState);
  const isSendingRef = useRef(isSending);
  const userIdRef = useRef(userId);

  const canSend = Boolean(
    socketConnected && userId && !isSending && (draft.trim().length > 0 || selectedFileState)
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
      setError(payload.reason || 'Join bi tu choi');
    });

    socket.on('message:new', (message: Message) => {
      setMessages((prev) => upsertMessage(prev, message));
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
    if (!nickname.trim()) {
      setError('Vui long nhap nickname');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const data = await api.startSession(nickname.trim());
      const token = data.data.accessToken;
      if (!token) {
        throw new Error('Khong nhan duoc accessToken');
      }

      setAccessToken(token);
      setSessionNickname(nickname.trim());
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loi khong xac dinh');
      setStatus('error');
    }
  };

  const sendMessage = async () => {
    const content = draftRef.current.trim();
    const file = selectedFileRef.current;

    if (!socketRef.current?.connected || isSendingRef.current || (!content && !file)) return;

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
      receiver: 'admin',
      ...(socketFile ? { file: socketFile } : {}),
    });

    setMessages((prev) => [
      ...prev,
      {
        content: content || null,
        sender: userId || 'user',
        receiver: 'admin',
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
    ]);

    setIsSending(false);
    isSendingRef.current = false;
  };

  const resetSession = () => {
    setAccessToken(null);
    setSessionNickname('');
    setUserId(null);
    setMessages([]);
    setSelectedFileState(null);
    setIsSending(false);
    setStatus('idle');
    setError(null);
    socketRef.current?.disconnect();
    socketRef.current = null;
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
    setNickname,
    setDraft,
    setSelectedFile,
    clearAttachment,
    startSession,
    sendMessage,
    resetSession,
  };
};

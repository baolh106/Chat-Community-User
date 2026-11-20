import { useCallback, useState } from 'react';
import type { ChatStatus, Message } from '../types';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useAuthSession } from './useAuthSession';
import { useChatSocket } from './useChatSocket';
import { useConversations } from './useConversations';
import { useMessageSender } from './useMessageSender';
import { useVideoCall, type VideoCallState } from './useVideoCall';

export type { VideoCallState } from './useVideoCall';

const STORAGE_KEY = 'admin_chat_auth';
const ADMIN_ID = 'admin';
const ADMIN_NICKNAME = 'Administrator';

type LoginStatus = Extract<ChatStatus, 'idle' | 'loading' | 'error'>;

const STATUS_TEXT: Record<ChatStatus, string> = {
  idle: 'Not logged in',
  loading: 'Not logged in',
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

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
  /** Trả `true` khi đăng nhập thành công; `false` để form reset reCAPTCHA (token chỉ dùng một lần). */
  startSession: () => Promise<boolean>;
  sendMessage: () => Promise<void>;
  retryMessage: (tempId: string) => void;
  resetSession: () => void;
}

/** Ghép các hook nghiệp vụ thành API cho trang admin. Không chứa logic riêng ngoài form đăng nhập. */
export const useChat = (): UseChatReturn => {
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const auth = useAuthSession({ storageKey: STORAGE_KEY, refresh: api.refreshSession });
  const { refresh: refreshAuth } = auth;

  const handleAuthError = useCallback(async () => {
    const refreshed = await refreshAuth();
    if (!refreshed) setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    return refreshed;
  }, [refreshAuth]);

  const handleConnectionError = useCallback(() => setError('Fail connection.'), []);

  const connection = useChatSocket({
    accessToken: auth.accessToken,
    joinEvent: 'admin:join',
    onAuthError: handleAuthError,
    onConnectionError: handleConnectionError,
  });
  const { socket, isConnected } = connection;

  const conversations = useConversations({
    socket,
    isActive: auth.isActive,
    accessToken: auth.accessToken,
    onError: setError,
  });
  const { selectedUserId } = conversations;

  const sender = useMessageSender({
    socket,
    isActive: auth.isActive,
    senderId: auth.isActive ? ADMIN_ID : null,
    updateConversation: conversations.updateConversation,
    onError: setError,
  });

  const call = useVideoCall({ socket, isConnected });

  const resetSession = () => {
    auth.end();
    setError(null);
    setLoginStatus('idle');
  };

  const startSession = async (): Promise<boolean> => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Vui lòng nhập mật khẩu admin');
      return false;
    }
    if (!captchaToken) {
      setError('Vui lòng xác thực reCAPTCHA');
      return false;
    }

    setError(null);
    setLoginStatus('loading');

    try {
      const tokens = await api.adminLogin(trimmed, captchaToken);
      if (!tokens.refreshToken) throw new Error('Không nhận được accessToken hoặc refreshToken');
      auth.establish(
        { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        ADMIN_NICKNAME,
      );
      setLoginStatus('idle');
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Lỗi không xác định'));
      setLoginStatus('error');
      return false;
    }
  };

  const status: ChatStatus = auth.accessToken ? connection.status : loginStatus;
  const canSend = Boolean(isConnected && selectedUserId && !sender.isSending && sender.hasContent);

  return {
    password,
    sessionNickname: auth.isActive ? auth.nickname || ADMIN_NICKNAME : '',
    status,
    socketConnected: isConnected,
    userId: auth.isActive ? ADMIN_ID : null,
    onlineUsers: conversations.onlineUsers,
    selectedUserId,
    unreadCounts: conversations.unreadCounts,
    messages: conversations.messages,
    draft: sender.draft,
    selectedFiles: sender.selectedFiles,
    isSending: sender.isSending,
    error,
    canSend,
    statusText: STATUS_TEXT[status],
    videoCall: {
      ...call,
      canStartCall: isConnected && Boolean(selectedUserId) && selectedUserId !== ADMIN_ID,
      startCall: (receiver?: string) => call.startCall(receiver ?? selectedUserId ?? ''),
    },
    setPassword,
    setCaptchaToken,
    setDraft: sender.setDraft,
    setSelectedFiles: sender.setSelectedFiles,
    clearAttachment: sender.clearAttachment,
    setSelectedUserId: conversations.selectUser,
    startSession,
    sendMessage: () => sender.sendMessage(selectedUserId),
    retryMessage: sender.retryMessage,
    resetSession,
  };
};

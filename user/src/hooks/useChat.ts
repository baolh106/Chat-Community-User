import { useCallback, useState } from 'react';
import type { ChatStatus, Message } from '../types';
import { api } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useAuthSession } from './useAuthSession';
import { useChatSocket } from './useChatSocket';
import { useMessageSender } from './useMessageSender';
import { useMessages } from './useMessages';
import { useVideoCall, type VideoCallState } from './useVideoCall';

export type { VideoCallState } from './useVideoCall';

const STORAGE_KEY = 'user_chat_auth';
const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 15;

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
  nickname: string;
  sessionNickname: string;
  status: ChatStatus;
  socketConnected: boolean;
  userId: string | null;
  messages: Message[];
  draft: string;
  selectedFiles: File[];
  isSending: boolean;
  error: string | null;
  canSend: boolean;
  statusText: string;
  videoCall: VideoCallState;
  setNickname: (value: string) => void;
  setCaptchaToken: (token: string | null) => void;
  setDraft: (value: string) => void;
  setSelectedFiles: (files: File[]) => void;
  clearAttachment: () => void;
  /** Trả `true` khi đăng nhập thành công; `false` để form reset reCAPTCHA (token chỉ dùng một lần). */
  startSession: () => Promise<boolean>;
  sendMessage: () => Promise<void>;
  retryMessage: (tempId: string) => void;
  resetSession: () => void;
}

/** Ghép các hook nghiệp vụ thành API cho `App`. Không chứa logic riêng ngoài form đăng nhập. */
export const useChat = (): UseChatReturn => {
  const [nickname, setNickname] = useState('');
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
    joinEvent: 'user:join',
    onAuthError: handleAuthError,
    onConnectionError: handleConnectionError,
  });
  const { socket, isConnected } = connection;

  const conversation = useMessages({
    socket,
    isActive: auth.isActive,
    nickname: auth.nickname,
    onError: setError,
  });

  const sender = useMessageSender({
    socket,
    isActive: auth.isActive,
    senderId: conversation.userId,
    updateConversation: conversation.updateConversation,
    onError: setError,
  });

  const call = useVideoCall({ socket, isConnected });

  const resetSession = () => {
    auth.end();
    setError(null);
    setLoginStatus('idle');
  };

  const startSession = async (): Promise<boolean> => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Vui lòng nhập nickname');
      return false;
    }
    if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
      setError(`Nickname phải có từ ${NICKNAME_MIN_LENGTH} đến ${NICKNAME_MAX_LENGTH} ký tự`);
      return false;
    }
    if (!captchaToken) {
      setError('Vui lòng xác thực reCAPTCHA');
      return false;
    }

    // Bỏ phiên cũ (nếu có) trước khi bắt đầu phiên mới.
    auth.end();
    setError(null);
    setLoginStatus('loading');

    try {
      const tokens = await api.startSession(trimmed, captchaToken);
      if (!tokens.refreshToken) throw new Error('Không nhận được accessToken hoặc refreshToken');
      auth.establish({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }, trimmed);
      setLoginStatus('idle');
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Lỗi không xác định'));
      setLoginStatus('error');
      return false;
    }
  };

  const status: ChatStatus = auth.accessToken ? connection.status : loginStatus;
  const canSend = Boolean(
    isConnected && conversation.userId && !sender.isSending && sender.hasContent,
  );

  return {
    nickname,
    sessionNickname: auth.nickname,
    status,
    socketConnected: isConnected,
    userId: conversation.userId,
    messages: conversation.messages,
    draft: sender.draft,
    selectedFiles: sender.selectedFiles,
    isSending: sender.isSending,
    error,
    canSend,
    statusText: STATUS_TEXT[status],
    videoCall: {
      ...call,
      canStartCall: isConnected && Boolean(conversation.userId),
    },
    setNickname,
    setCaptchaToken,
    setDraft: sender.setDraft,
    setSelectedFiles: sender.setSelectedFiles,
    clearAttachment: sender.clearAttachment,
    startSession,
    sendMessage: () => sender.sendMessage('admin'),
    retryMessage: sender.retryMessage,
    resetSession,
  };
};

import { useEffect, useRef, useState } from 'react';
import type { AppSocket, ChatStatus } from '../types';
import { createSocket } from '../utils/socket';
import { useEventCallback } from './useEventCallback';

const AUTH_ERROR_PATTERN = /unauthorized|token|expired|jwt|authentication/i;

type Options = {
  accessToken: string | null;
  joinEvent: 'user:join' | 'admin:join';
  /** Gọi khi server từ chối token; trả `true` nếu đã refresh được token mới. */
  onAuthError: () => Promise<boolean>;
  onConnectionError: () => void;
};

/**
 * Vòng đời kết nối Socket.IO: tạo socket theo access token, join phòng khi kết nối,
 * refresh token một lần khi bị từ chối. Các hook khác đăng ký event qua `useSocketEvent`.
 */
export const useChatSocket = ({ accessToken, joinEvent, onAuthError, onConnectionError }: Options) => {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const refreshAttemptedRef = useRef(false);
  const handleAuthError = useEventCallback(onAuthError);
  const handleConnectionError = useEventCallback(onConnectionError);

  useEffect(() => {
    if (!accessToken) return;

    refreshAttemptedRef.current = false;
    const nextSocket = createSocket(accessToken);

    const handleConnect = () => {
      setStatus('connected');
      nextSocket.emit(joinEvent);
    };
    const handleDisconnect = () => setStatus('disconnected');
    const handleConnectErrorEvent = (err: Error) => {
      console.error('[socket] connect_error', err);
      if (AUTH_ERROR_PATTERN.test(err.message) && !refreshAttemptedRef.current) {
        refreshAttemptedRef.current = true;
        nextSocket.disconnect();
        void handleAuthError().then((refreshed) => {
          if (!refreshed) setStatus('error');
        });
        return;
      }
      setStatus('error');
      handleConnectionError();
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', handleConnectErrorEvent);
    setSocket(nextSocket);
    setStatus('connecting');

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('connect_error', handleConnectErrorEvent);
      nextSocket.disconnect();
      setSocket(null);
      setStatus('idle');
    };
  }, [accessToken, joinEvent, handleAuthError, handleConnectionError]);

  // Kết nối sau khi các hook khác đã đăng ký listener cho socket mới (cùng một lần commit).
  useEffect(() => {
    socket?.connect();
  }, [socket]);

  return { socket, status, isConnected: status === 'connected' };
};

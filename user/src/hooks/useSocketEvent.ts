import { useEffect } from 'react';
import type { AppSocket, ServerEventName } from '../types';
import { useEventCallback } from './useEventCallback';

/** Đăng ký listener cho một event server; tự gỡ đúng handler khi socket đổi hoặc unmount. */
export const useSocketEvent = (
  socket: AppSocket | null,
  event: ServerEventName,
  handler: (payload: unknown) => void,
): void => {
  const stableHandler = useEventCallback(handler);

  useEffect(() => {
    if (!socket) return;
    socket.on(event, stableHandler);
    return () => {
      socket.off(event, stableHandler);
    };
  }, [socket, event, stableHandler]);
};

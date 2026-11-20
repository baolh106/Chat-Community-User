import { io } from 'socket.io-client';
import type { AppSocket } from '../types';

/**
 * Tạo socket chưa kết nối (`autoConnect: false`): hook gọi `connect()` sau khi
 * mọi listener đã đăng ký, để không bỏ lỡ event đầu tiên.
 */
export const createSocket = (accessToken: string): AppSocket =>
  io(window.location.origin, {
    auth: { token: accessToken },
    transports: ['websocket'],
    autoConnect: false,
  });

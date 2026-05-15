import { io, Socket } from 'socket.io-client';

export const createSocket = (accessToken: string): Socket => {
  return io(window.location.origin, {
    auth: { token: accessToken },
    transports: ['websocket'],
  });
};

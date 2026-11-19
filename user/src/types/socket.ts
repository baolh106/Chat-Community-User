import type { Socket } from 'socket.io-client';
import type { SocketFilePayload } from './index';

/**
 * Hợp đồng Socket.IO với BE.
 * Payload server gửi xuống luôn là `unknown`: phải parse ở biên (utils/messages, utils/guards)
 * thay vì tin type tĩnh.
 */
type ServerListener = (payload: unknown) => void;

export interface ServerToClientEvents {
  'user:joined': ServerListener;
  'user:join_denied': ServerListener;
  'user:left': ServerListener;
  'admin:joined': ServerListener;
  'message:new': ServerListener;
  'message:send:ack': ServerListener;
  'message:uploading': ServerListener;
  'message:upload:error': ServerListener;
  'message:error': ServerListener;
  'call:incoming': ServerListener;
  'call:accepted': ServerListener;
  'call:ice-candidate': ServerListener;
  'call:error': ServerListener;
  'call:rejected': ServerListener;
  'call:cancelled': ServerListener;
  'call:cancel': ServerListener;
  'call:ended': ServerListener;
  'call:end': ServerListener;
}

export type ServerEventName = keyof ServerToClientEvents;

export type SendMessagePayload = {
  tempId: string;
  content: string | null;
  receiver: string;
  files: SocketFilePayload[];
};

export type CallTarget = {
  callId: string;
  receiver: string;
};

export type CallInvitePayload = CallTarget & {
  mediaType: 'video';
  offer: RTCSessionDescriptionInit;
};

export interface ClientToServerEvents {
  'user:join': () => void;
  'admin:join': () => void;
  'message:send': (payload: SendMessagePayload) => void;
  'call:invite': (payload: CallInvitePayload, ack: (response: unknown) => void) => void;
  'call:accept': (payload: CallTarget & { answer: RTCSessionDescriptionInit }) => void;
  'call:ice-candidate': (payload: CallTarget & { candidate: RTCIceCandidateInit }) => void;
  'call:reject': (payload: CallTarget) => void;
  'call:cancel': (payload: CallTarget) => void;
  'call:end': (payload: CallTarget) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

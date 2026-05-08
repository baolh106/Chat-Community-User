export type Message = {
  content: string;
  sender: string;
  receiver: string;
  createdAt: string;
  imageURL?: string;
};

export type SocketPayload = {
  ok: boolean;
  userId?: string;
  reason?: string;
};

export type ChatStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

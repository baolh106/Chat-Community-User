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
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message: string;
  success: boolean;
};

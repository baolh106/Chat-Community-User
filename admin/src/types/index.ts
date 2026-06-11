export type Message = {
  content: string | null;
  sender: string;
  receiver: string;
  createdAt: string;
  imageURL?: string;
  fileURL?: string;
  fileDownloadURL?: string | null;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  fileDriveId?: string;
  attachmentType?: 'image' | 'file';
  attachments?: Array<{
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
    type: 'image' | 'file';
  }>;
  hasAttachments?: boolean;
};

export type SocketPayload = {
  ok: boolean;
  userId?: string;
  reason?: string;
};

export type SocketFilePayload = {
  data: string;
  name: string;
  mimeType: string;
};

export type ChatStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type CallInfo = {
  callId: string;
  caller: string;
  remoteStream: MediaStream | null;
  status: 'incoming' | 'accepted' | 'ongoing' | 'outgoing';
  pc: RTCPeerConnection | null;
  offer?: RTCSessionDescriptionInit;
};

export type AuthResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message: string;
  success: boolean;
};

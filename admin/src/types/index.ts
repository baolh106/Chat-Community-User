export type AttachmentType = 'image' | 'file';

export type Attachment = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
  type: AttachmentType;
  isUnsafe?: boolean;
  unsafeReason?: string;
};

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type Message = {
  /** Id do server cấp. */
  id?: string;
  /** Id tạm do client tạo khi gửi, dùng để khớp ack với tin optimistic. */
  tempId?: string;
  status?: MessageStatus;
  content: string | null;
  sender: string;
  receiver: string;
  createdAt: string;
  attachments?: Attachment[];
  hasAttachments?: boolean;
  /** Tên file server đang xử lý (giữa `message:uploading` và ack). */
  uploadingFileName?: string;
  isRead?: boolean;
};

export type ChatStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export type AuthResponse = {
  data: AuthTokens;
  message: string;
  success: boolean;
};

export type SocketFilePayload = {
  data: string;
  name: string;
  mimeType: string;
};

export type CallInfo = {
  callId: string;
  caller: string;
  remoteStream: MediaStream | null;
  status: 'incoming' | 'accepted' | 'ongoing' | 'outgoing';
  pc: RTCPeerConnection | null;
  offer?: RTCSessionDescriptionInit;
};

export type * from './socket';

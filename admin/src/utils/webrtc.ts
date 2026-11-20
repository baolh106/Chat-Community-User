import { getString, isRecord } from './guards';

const STUN_SERVER: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

/**
 * TURN cấu hình qua env (`VITE_TURN_URL` có thể chứa nhiều URL cách nhau bằng dấu phẩy).
 * Không có TURN thì cuộc gọi giữa hai mạng NAT chặt (4G, mạng công ty) thường không thông.
 * Lưu ý: credential `VITE_*` nằm trong bundle; nên dùng credential ngắn hạn do BE cấp khi có thể.
 */
const readTurnServer = (): RTCIceServer | null => {
  const urls = (import.meta.env.VITE_TURN_URL ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length === 0) return null;
  return {
    urls,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  };
};

export const getIceServers = (): RTCIceServer[] => {
  const turn = readTurnServer();
  return turn ? [STUN_SERVER, turn] : [STUN_SERVER];
};

/** Thời gian chờ người kia bắt máy trước khi tự huỷ cuộc gọi đi. */
export const NO_ANSWER_TIMEOUT_MS = 30_000;

const SDP_TYPES: ReadonlySet<string> = new Set(['offer', 'answer', 'pranswer', 'rollback']);

export const parseSessionDescription = (value: unknown): RTCSessionDescriptionInit | null => {
  if (!isRecord(value)) return null;
  const type = getString(value, 'type');
  if (!type || !SDP_TYPES.has(type)) return null;
  return { type: type as RTCSdpType, sdp: getString(value, 'sdp') };
};

export const parseIceCandidate = (value: unknown): RTCIceCandidateInit | null => {
  if (!isRecord(value) || typeof value.candidate !== 'string') return null;
  return {
    candidate: value.candidate,
    sdpMid: typeof value.sdpMid === 'string' ? value.sdpMid : null,
    sdpMLineIndex: typeof value.sdpMLineIndex === 'number' ? value.sdpMLineIndex : null,
    usernameFragment: getString(value, 'usernameFragment') ?? null,
  };
};

export const describeTracks = (stream: MediaStream | null | undefined) =>
  stream?.getTracks().map((track) => ({ kind: track.kind, enabled: track.enabled, id: track.id }));

const getErrorName = (err: unknown) =>
  isRecord(err) && typeof err.name === 'string' ? err.name : undefined;

/** Lỗi thiếu/hỏng thiết bị: vẫn thử gọi chỉ với micro. Lỗi bị từ chối quyền thì không thử lại. */
const AUDIO_FALLBACK_ERRORS: ReadonlySet<string> = new Set([
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
]);

/** Xin camera + micro; không có camera dùng được thì chỉ xin micro. */
export const getLocalMedia = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    const name = getErrorName(err);
    if (name && AUDIO_FALLBACK_ERRORS.has(name)) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    throw err;
  }
};

export const describeMediaError = (err: unknown): string => {
  switch (getErrorName(err)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Bạn chưa cấp quyền camera/micro cho trang này';
    case 'NotFoundError':
      return 'Không tìm thấy camera hoặc micro';
    case 'NotReadableError':
      return 'Camera/micro đang được ứng dụng khác sử dụng';
    default:
      return 'Không thể truy cập camera/micro';
  }
};

/**
 * Giữ ICE candidate local cho tới khi offer/answer đã được gửi, để server
 * không nhận candidate của một cuộc gọi nó chưa biết (review #6).
 */
export const createIceSignaler = (send: (candidate: RTCIceCandidateInit) => void) => {
  let isOpen = false;
  const queue: RTCIceCandidateInit[] = [];
  return {
    push(candidate: RTCIceCandidateInit) {
      if (isOpen) send(candidate);
      else queue.push(candidate);
    },
    open() {
      isOpen = true;
      queue.splice(0).forEach(send);
    },
  };
};

export type IceSignaler = ReturnType<typeof createIceSignaler>;

import { getString, isRecord } from './guards';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  nickname: string;
};

/**
 * Phiên đăng nhập lưu trong sessionStorage: F5 vẫn giữ phiên, đóng tab là mất.
 * Không lưu tin nhắn ở client. Mọi truy cập storage đều có thể ném lỗi
 * (private mode, quota, bị chặn) nên luôn bọc try/catch.
 */
const getStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** Xoá dữ liệu phiên cũ (token + lịch sử chat) từng được lưu trong localStorage. */
const removeLegacyEntry = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage bị chặn: không có gì để dọn.
  }
};

export const loadSession = (key: string): StoredSession | null => {
  removeLegacyEntry(key);
  try {
    const raw = getStorage()?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const accessToken = getString(parsed, 'accessToken');
    const refreshToken = getString(parsed, 'refreshToken');
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken, nickname: getString(parsed, 'nickname') ?? '' };
  } catch {
    return null;
  }
};

export const saveSession = (key: string, session: StoredSession): void => {
  try {
    getStorage()?.setItem(key, JSON.stringify(session));
  } catch {
    // Không lưu được thì phiên chỉ sống trong bộ nhớ; F5 sẽ phải đăng nhập lại.
  }
};

export const clearSession = (key: string): void => {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Storage bị chặn: không có gì để xoá.
  }
};

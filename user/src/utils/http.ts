import { getNumber, getString, isRecord } from './guards';

const API_BASE = '/api';

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string | null;
  /** Thông báo dùng khi server không trả `message`. */
  errorMessage: string;
};

/** Gọi REST API, trả body JSON dạng `unknown` để nơi gọi tự parse. */
export const requestJson = async (
  path: string,
  { method = 'POST', body, accessToken, errorMessage }: RequestOptions,
): Promise<unknown> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Body lỗi có thể không phải JSON (vd. trang lỗi của Nginx).
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((isRecord(data) && getString(data, 'message')) || errorMessage);
  }
  return data;
};

export type AuthResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

/** Parse `{ data: { accessToken, refreshToken, expiresIn } }`. */
export const parseAuthResponse = (data: unknown): AuthResult => {
  const payload = isRecord(data) && isRecord(data.data) ? data.data : null;
  const accessToken = payload ? getString(payload, 'accessToken') : undefined;
  if (!payload || !accessToken) {
    throw new Error('Không nhận được accessToken');
  }
  return {
    accessToken,
    refreshToken: getString(payload, 'refreshToken'),
    expiresIn: getNumber(payload, 'expiresIn'),
  };
};

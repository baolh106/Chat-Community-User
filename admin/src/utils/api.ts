import { getNumber, isRecord } from './guards';
import { parseAuthResponse, requestJson, type AuthResult } from './http';

export const api = {
  async adminLogin(password: string, recaptchaToken: string): Promise<AuthResult> {
    const data = await requestJson('/auth/admin/login', {
      body: { password, recaptchaToken },
      errorMessage: 'Lỗi khi đăng nhập Admin',
    });
    return parseAuthResponse(data);
  },

  async refreshSession(refreshToken: string): Promise<AuthResult> {
    const data = await requestJson('/auth/refresh', {
      body: { refreshToken },
      errorMessage: 'Lỗi khi refresh session',
    });
    return parseAuthResponse(data);
  },

  async getUnreadCount(conversationKey: string, readerId: string, accessToken: string | null) {
    const query = new URLSearchParams({ readerId });
    const data = await requestJson(
      `/message/unread-count/${encodeURIComponent(conversationKey)}?${query.toString()}`,
      { method: 'GET', accessToken, errorMessage: 'Lỗi khi lấy unread count' },
    );
    return (isRecord(data) && isRecord(data.data) && getNumber(data.data, 'unreadCount')) || 0;
  },

  async markRead(conversationKey: string, readerId: string, accessToken: string | null) {
    await requestJson('/message/mark-read', {
      body: { conversationKey, readerId },
      accessToken,
      errorMessage: 'Lỗi khi đánh dấu đã đọc',
    });
  },
};

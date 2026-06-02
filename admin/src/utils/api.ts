import type { AuthResponse } from '../types';

const API_BASE = '/api';

interface AdminLoginBody {
  password: string;
  recaptchaToken?: string;
}

export const api = {
  async adminLogin(password: string, recaptchaToken?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, recaptchaToken }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.message || 'Lỗi khi đăng nhập Admin');
    }

    return response.json();
  },

  async refreshSession(refreshToken: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.message || 'Lỗi khi refresh session');
    }

    return response.json();
  },
  async getUnreadCount(conversationKey: string, readerId: string, accessToken?: string) {
    const url = `${API_BASE}/message/unread-count/${encodeURIComponent(conversationKey)}?readerId=${encodeURIComponent(
      readerId
    )}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || 'Lỗi khi lấy unread count');
    }
    return response.json();
  },

  async markRead(conversationKey: string, readerId: string, accessToken?: string) {
    const url = `${API_BASE}/message/mark-read`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationKey, readerId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || 'Lỗi khi đánh dấu đã đọc');
    }
    return response.json();
  },
};

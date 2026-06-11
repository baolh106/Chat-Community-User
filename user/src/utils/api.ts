import type { AuthResponse } from '../types';

const API_BASE = '/api';

export const api = {
  async startSession(nickname: string, recaptchaToken?: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nickname, recaptchaToken }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.message || 'Lỗi khi tạo session');
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
};

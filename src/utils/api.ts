import type { AuthResponse } from '../types';

const API_BASE = '/api';

export const api = {
  async startSession(nickname: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nickname }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.message || 'Lỗi khi tạo session');
    }

    return response.json();
  },
};

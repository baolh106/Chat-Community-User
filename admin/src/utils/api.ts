import type { AuthResponse } from '../types';

const API_BASE = '/api';

interface AdminLoginBody {
  password: string;
}

export const api = {
  async adminLogin(password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body?.message || 'Lỗi khi đăng nhập Admin');
    }

    return response.json();
  },
};

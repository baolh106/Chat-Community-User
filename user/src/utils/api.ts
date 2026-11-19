import { parseAuthResponse, requestJson, type AuthResult } from './http';

export const api = {
  async startSession(nickname: string, recaptchaToken: string): Promise<AuthResult> {
    const data = await requestJson('/auth/start', {
      body: { nickname, recaptchaToken },
      errorMessage: 'Lỗi khi tạo session',
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
};

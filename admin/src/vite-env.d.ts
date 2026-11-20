/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /** Chỉ dùng cho proxy dev trong vite.config.ts. */
  readonly VITE_API_BASE?: string;
  /** Một hoặc nhiều URL TURN, cách nhau bằng dấu phẩy (vd. turn:turn.example.com:3478). */
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

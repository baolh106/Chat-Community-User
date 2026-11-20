/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_PORT = 4000;

export default defineConfig(({ mode }) => {
  // Prefix '' để đọc cả biến không có tiền tố VITE_ (vd. PORT); chỉ dùng trong config, không vào bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE || 'http://localhost:3000';
  const port = env.PORT ? Number.parseInt(env.PORT, 10) : DEFAULT_PORT;

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': { target: apiBase, changeOrigin: true, secure: false },
        '/socket.io': { target: apiBase, ws: true, changeOrigin: true, secure: false },
      },
    },
    test: {
      environment: 'jsdom',
      css: false,
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Lấy các biến môi trường dựa trên mode (development/production)
  const env = loadEnv(mode, process.cwd());
  const API_BASE = env.VITE_API_BASE || 'http://localhost:3000';
  const port = env.PORT ? parseInt(env.PORT) : 4000;

  return {
    plugins: [react()],
    server: {
      port: port,
      strictPort: true,
      proxy: {
        '/api': {
          target: API_BASE,
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: API_BASE,
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});

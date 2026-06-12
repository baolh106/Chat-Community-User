import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://api.baoworld.us',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'https://api.baoworld.us',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
});

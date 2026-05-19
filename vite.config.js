import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../backend-laravel/public',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // target: 'https://vet-api.sirilmotors.com',
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
});

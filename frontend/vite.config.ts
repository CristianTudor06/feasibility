import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The production build is written straight into the Flask package so the
// workstation only needs Python to serve it (see ../README.md).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../feasibility/static'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
  },
  server: {
    // `npm run dev` serves the UI with hot reload and forwards API calls to Flask.
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
});

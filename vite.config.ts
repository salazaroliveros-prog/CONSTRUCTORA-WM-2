import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('firebase/')) return 'vendor-firebase';
            if (id.includes('firebase-admin')) return 'vendor-firebase-admin';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('jspdf')) return 'vendor-pdf';
            if (id.includes('motion')) return 'vendor-motion';
          },
        },
        // Exclude firebase-admin from client bundle entirely
        external: [],
      },
      target: 'esnext',
      minify: 'terser',
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 4173,
    },
  };
});
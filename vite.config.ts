import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api/ticktick/token': {
        target: 'https://ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/token/, '/oauth/token'),
      },
      '/api/ticktick/open': {
        target: 'https://api.ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/open/, '/open/v1'),
      },
      '/api/ticktick/mcp': {
        target: 'https://mcp.ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/mcp/, ''),
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api/ticktick/token': {
        target: 'https://ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/token/, '/oauth/token'),
      },
      '/api/ticktick/open': {
        target: 'https://api.ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/open/, '/open/v1'),
      },
      '/api/ticktick/mcp': {
        target: 'https://mcp.ticktick.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticktick\/mcp/, ''),
      },
    },
  },
})

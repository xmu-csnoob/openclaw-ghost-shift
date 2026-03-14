import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devHost = process.env.GHOST_SHIFT_DEV_HOST || process.env.PIXEL_OFFICE_DEV_HOST || '127.0.0.1'
const devPort = Number(process.env.GHOST_SHIFT_DEV_PORT || process.env.PIXEL_OFFICE_DEV_PORT || '3001')
const apiTarget = process.env.GHOST_SHIFT_API_TARGET || process.env.PIXEL_OFFICE_API_TARGET || 'http://127.0.0.1:3002'
const allowedHosts = (process.env.GHOST_SHIFT_ALLOWED_HOSTS || process.env.PIXEL_OFFICE_ALLOWED_HOSTS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: devPort,
    host: devHost,
    strictPort: true,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

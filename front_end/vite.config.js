import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // เปิดให้เข้าถึงผ่าน IP และ Tunnel ภายนอกได้
    allowedHosts: true, // อนุญาตให้เชื่อมต่อผ่าน Cloudflare Tunnel หรือโดเมนภายนอกได้
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})

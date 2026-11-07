import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // เปิดให้เครื่องภายนอกเข้าถึงได้
    allowedHosts: true, // อนุญาตให้เชื่อมต่อผ่าน Cloudflare Tunnel ทุกโดเมน
    proxy: {
      "/api": {
        target: "http://localhost:5000", // ส่งคำขอ /api ไปยัง Backend
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000", // ส่งคำขอรูปภาพไปยัง Backend
        changeOrigin: true,
      },
    },
  },
});

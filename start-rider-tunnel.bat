@echo off
chcp 65001 >nul
title POS Rider 4G/5G Tunnel
echo ================================================================
echo   ระบบเชื่อมต่อหน้าจอมือถือไรเดอร์ (Rider Mobile 4G/5G)
echo   POS Project - Cloudflare Tunnel
echo ================================================================
echo.
echo กำลังเริ่มต้นเชื่อมต่อ Cloudflare Tunnel...
echo หมายเหตุ:
echo 1. ต้องเปิด Backend (พอร์ต 5000) และ Frontend (พอร์ต 5173) อยู่
echo 2. เมื่อหน้าจอขึ้นลิงก์ https://xxxx.trycloudflare.com
echo    ให้คัดลอกลิงก์นั้นแล้วตามด้วย /rider-delivery ส่งให้ไรเดอร์
echo    เช่น: https://xxxx.trycloudflare.com/rider-delivery
echo 3. ไรเดอร์สามารถเปิดผ่าน 4G / 5G จากมือถือได้ทุกที่ทั่วโลก
echo ================================================================
echo.

"%~dp0cloudflared.exe" tunnel --url http://localhost:5173
pause

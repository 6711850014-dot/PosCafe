// ==============================================================================
// ไฟล์: front_end/src/components/Layout.jsx
// ระบบ: Flexible Responsive Layout สำหรับระบบ PosCafe
// หน้าที่:
//   1. รองรับการยุบ/ขยายแถบเมนูด้านซ้าย (Collapsible Sidebar)
//   2. จดจำสถานะยุบ/ขยายไว้ใน localStorage (จำค่าที่ผู้ใช้เลือกไว้)
//   3. ปรับขนาดความกว้างของเนื้อหาหลัก (Main Content) ให้ยืดหยุ่นตามขนาดหน้าจอและการซูม
// ==============================================================================
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  // จดจำการตั้งค่าการยุบเมนูใน localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pos_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // ฟังก์ชันสลับสถานะยุบ/ขยาย
  const handleToggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("pos_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className={`app-layout ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={isCollapsed} onToggle={handleToggleSidebar} />
      <main className="app-main-content">
        <Outlet />
      </main>
    </div>
  );
}

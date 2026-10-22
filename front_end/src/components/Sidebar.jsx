// ==============================================================================
// ไฟล์: front_end/src/components/Sidebar.jsx
// ระบบ: แถบเมนูด้านข้างพร้อมการตรวจสอบสิทธิ์แบบไดนามิก (Dynamic RBAC Navigation)
// วัตถุประสงค์:
//   - อ่านข้อมูลผู้ใช้งานและรายการ permissions จาก `sessionStorage`
//   - กรองและแสดงผลเฉพาะเมนูที่ผู้ใช้นั้นได้รับอนุญาตให้เข้าถึง
//   - หากเป็น Admin (role_id = 1) จะสามารถมองเห็นและเข้าถึงได้ทุกเมนูอัตโนมัติ
//   - มีปุ่ม Logout พร้อมกล่องยืนยัน SweetAlert2
// ==============================================================================

import React from "react";
import "./Sidebar.css";
import { useNavigate, Link, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaCashRegister,
  FaBoxOpen,
  FaWarehouse,
  FaUsers,
  FaChartBar,
  FaSignOutAlt,
  FaMotorcycle,
  FaTag,
  FaBoxes,
  FaMobileAlt
} from "react-icons/fa";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ออกจากระบบ เคลียร์ Session และเปลี่ยนหน้ากลับไปที่ /login
  // ----------------------------------------------------------------------------
  const handleLogoutClick = () => {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ?',
      text: "คุณต้องการออกจากระบบใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        window.location.href = "/login";
      }
    });
  };

  // ดึงข้อมูลผู้ใช้งานที่ล็อกอินอยู่จาก sessionStorage
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const userRoleId = Number(user?.role_id) || 0;
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];

  // ----------------------------------------------------------------------------
  // ตารางเมนูทั้งหมดในระบบ พร้อมระบุ Permission Key ที่ต้องใช้ในการเข้าถึง
  // ----------------------------------------------------------------------------
  const allMenuItems = [
    { path: "/pos", label: "POS หน้าร้าน", icon: <FaCashRegister />, permission: "menu_pos", fallbackRoleIds: [1, 2] }, 
    { path: "/delivery", label: "การจัดส่ง (Delivery)", icon: <FaMotorcycle />, permission: "menu_delivery", fallbackRoleIds: [1] },
    { path: "/rider-delivery", label: "ไรเดอร์ส่งของ (Mobile)", icon: <FaMobileAlt />, permission: "menu_pos", fallbackRoleIds: [1, 2] },
    { path: "/promotions", label: "จัดการโปรโมชั่น", icon: <FaTag />, permission: "menu_promotions", fallbackRoleIds: [1] },
    { path: "/procurement", label: "จัดซื้อวัตถุดิบ", icon: <FaBoxes />, permission: "menu_procurement", fallbackRoleIds: [1] },
    { path: "/products", label: "จัดการสินค้า", icon: <FaBoxOpen />, permission: "menu_products", fallbackRoleIds: [1] }, 
    { path: "/stocks", label: "สต็อก/วัตถุดิบ", icon: <FaWarehouse />, permission: "menu_stocks", fallbackRoleIds: [1] }, 
    { path: "/employees", label: "พนักงาน", icon: <FaUsers />, permission: "menu_employees", fallbackRoleIds: [1] }, 
    { path: "/roles", label: "จัดการสิทธิ์", icon: <FaUsers />, permission: "menu_roles", fallbackRoleIds: [1] },
    { path: "/reports", label: "รายงานผลการขาย", icon: <FaChartBar />, permission: "menu_reports", fallbackRoleIds: [1] }, 
  ];

  // ----------------------------------------------------------------------------
  // การกรองเมนูตามสิทธิ์ (Permission Check):
  // 1. ถ้าเป็น Admin (role_id = 1) -> ผ่านทุกเมนู
  // 2. ถ้าใน permissions array ของผู้ใช้มี permission key ตรงกับเมนูนั้น -> ผ่าน
  // 3. ถ้าตรงกับ fallback role id เดิม -> ผ่าน
  // ----------------------------------------------------------------------------
  const authorizedMenus = allMenuItems.filter(item => {
    if (userRoleId === 1 || user?.role === 'Admin') return true;
    if (userPermissions.includes(item.permission)) return true;
    return item.fallbackRoleIds.includes(userRoleId);
  });

  return (
    <nav className="sidebar">
      <ul className="side-links">
        {/* แสดงเฉพาะเมนูที่ผ่านการตรวจสอบสิทธิ์แล้ว */}
        {authorizedMenus.map((item) => (
          <li
            key={item.path}
            className={location.pathname === item.path ? "active" : ""}
          >
            <Link to={item.path}>
              {item.icon} {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* ส่วนแสดงข้อมูลโปรไฟล์ผู้ใช้งาน และปุ่ม Logout */}
      <div className="account-section">
        <div className="account">
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
            {user?.name || "Guest"}
          </div>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>
            @{user?.username || "unknown"} | {user?.role || "ไม่ระบุตำแหน่ง"}
          </div>
        </div>

        <div className="logout" onClick={handleLogoutClick}>
          <FaSignOutAlt /> Logout
        </div>
      </div>
    </nav>
  );
}

export default Sidebar;

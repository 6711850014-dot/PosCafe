// ==============================================================================
// ไฟล์: front_end/src/components/Sidebar.jsx
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

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const userRoleId = Number(user?.role_id) || 0;
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];

  // ตารางเมนูทั้งหมดในระบบ 
  const allMenuItems = [
    { path: "/pos", label: "ขายหน้าร้าน", icon: <FaCashRegister />, permission: "menu_pos", fallbackRoleIds: [1, 2] }, 
    { path: "/delivery", label: "การจัดส่ง", icon: <FaMotorcycle />, permission: "menu_delivery", fallbackRoleIds: [1] },
    // แยก permission ของไรเดอร์เป็น "menu_rider" และใช้ Role ID 3
    { path: "/rider-delivery", label: "ไรเดอร์ส่งของ", icon: <FaMobileAlt />, permission: "menu_rider", fallbackRoleIds: [1, 3] },
    { path: "/promotions", label: "จัดการโปรโมชั่น", icon: <FaTag />, permission: "menu_promotions", fallbackRoleIds: [1] },
    { path: "/procurement", label: "จัดการซื้อวัตถุดิบ", icon: <FaBoxes />, permission: "menu_procurement", fallbackRoleIds: [1] },
    { path: "/products", label: "จัดการสินค้า", icon: <FaBoxOpen />, permission: "menu_products", fallbackRoleIds: [1] }, 
    { path: "/stocks", label: "สต็อกวัตถุดิบ", icon: <FaWarehouse />, permission: "menu_stocks", fallbackRoleIds: [1] }, 
    { path: "/employees", label: "พนักงาน", icon: <FaUsers />, permission: "menu_employees", fallbackRoleIds: [1] }, 
    { path: "/roles", label: "จัดการสิทธิ์", icon: <FaUsers />, permission: "menu_roles", fallbackRoleIds: [1] },
    { path: "/reports", label: "รายงานผลการขาย", icon: <FaChartBar />, permission: "menu_reports", fallbackRoleIds: [1] }, 
  ];

  // กรองเมนูตามสิทธิ์
  const authorizedMenus = allMenuItems.filter(item => {
    if (userRoleId === 1 || user?.role === 'Admin') return true;
    if (userPermissions.includes(item.permission)) return true;
    return item.fallbackRoleIds.includes(userRoleId);
  });

  return (
    <nav className="sidebar">
      <ul className="side-links">
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
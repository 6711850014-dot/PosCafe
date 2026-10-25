// ==============================================================================
// ไฟล์: front_end/src/components/Sidebar.jsx
// ระบบ: Navigation Sidebar สำหรับ PosCafe (รองรับ Scrollable และ Collapsible)
// ==============================================================================
import React from "react";
import "./Sidebar.css";
import { Link, useLocation } from "react-router-dom";
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
  FaMobileAlt,
  FaCoffee,
  FaChevronLeft,
  FaChevronRight,
  FaUserCircle
} from "react-icons/fa";

function Sidebar({ collapsed = false, onToggle }) {
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
    <nav className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* ส่วนหัวของแถบเมนู พร้อมปุ่มย่อ/ขยาย (Toggle Button) */}
      <div className="sidebar-header">
        {!collapsed ? (
          <div className="sidebar-brand">
            <FaCoffee className="brand-icon" />
            <span className="brand-text">PosCafe</span>
          </div>
        ) : (
          <div className="sidebar-brand-collapsed" title="PosCafe">
            <FaCoffee className="brand-icon" />
          </div>
        )}
        {onToggle && (
          <button 
            type="button" 
            className="sidebar-toggle-btn" 
            onClick={onToggle}
            title={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        )}
      </div>

      {/* รายการเมนูหลักที่สามารถ Scroll ขึ้น-ลงได้อย่างราบรื่น */}
      <div className="sidebar-scrollable-body">
        <ul className="side-links">
          {authorizedMenus.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li
                key={item.path}
                className={isActive ? "active" : ""}
                title={collapsed ? item.label : ""}
              >
                <Link to={item.path}>
                  <span className="menu-icon">{item.icon}</span>
                  {!collapsed && <span className="menu-text">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ส่วนข้อมูลผู้ใช้งานและปุ่มออกจากระบบด้านล่าง */}
      <div className="account-section">
        {!collapsed ? (
          <>
            <div className="account">
              <div className="account-name">{user?.name || "Guest"}</div>
              <div className="account-sub">
                @{user?.username || "unknown"} | {user?.role || "ไม่ระบุตำแหน่ง"}
              </div>
            </div>

            <button type="button" className="logout" onClick={handleLogoutClick}>
              <FaSignOutAlt />
              <span>ออกจากระบบ</span>
            </button>
          </>
        ) : (
          <div className="account-collapsed">
            <div 
              className="account-avatar-collapsed"
              title={`${user?.name || "Guest"} (@${user?.username || "unknown"} - ${user?.role || "ผู้ใช้"})`}
            >
              <FaUserCircle />
            </div>
            <button 
              type="button" 
              className="logout-collapsed" 
              onClick={handleLogoutClick}
              title="ออกจากระบบ"
            >
              <FaSignOutAlt />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Sidebar;

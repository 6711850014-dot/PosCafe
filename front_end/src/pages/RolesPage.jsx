// ==============================================================================
// ไฟล์: front_end/src/pages/RolesPage.jsx
// ระบบ: การจัดการตำแหน่งและสิทธิ์การใช้งาน (Roles & Dynamic Permissions UI)
// วัตถุประสงค์:
//   - ให้ผู้ดูแลระบบ (Admin) สามารถสร้างตำแหน่งใหม่ได้ไม่จำกัด
//   - กำหนดสิทธิ์แบบรายเมนู (Granular Permissions) เช่น สิทธิ์ขาย POS, สิทธิ์ดูรายงาน, สิทธิ์ Export CSV
//   - ป้องกันไม่ให้ลบตำแหน่ง Admin หลัก (role_id = 1) เพื่อความปลอดภัย
//   - ข้อมูลสิทธิ์จะถูกบันทึกเป็น JSONB และส่งต่อไปใช้ตรวจสอบการแสดงเมนูที่ Sidebar อัตโนมัติ
// ==============================================================================

import React, { useState, useEffect } from "react";
import "./RolesPage.css";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaShieldAlt, FaCheckSquare, FaSquare } from "react-icons/fa";
import Swal from "sweetalert2";

// ------------------------------------------------------------------------------
// ตารางสิทธิ์ทั้งหมดที่มีในระบบ POS (Permission Master Catalog)
// แต่ละรายการจะถูกนำไปผูกกับการเปิด/ปิดเมนูที่หน้า Sidebar และปุ่ม Action ต่างๆ
// ------------------------------------------------------------------------------
const AVAILABLE_PERMISSIONS = [
  { id: "menu_pos", label: "ระบบขาย POS หน้าร้าน", category: "เมนูหลัก" },
  { id: "menu_delivery", label: "จัดการการส่งสินค้า (Delivery)", category: "เมนูหลัก" },
  { id: "menu_promotions", label: "จัดการโปรโมชั่นส่วนลด", category: "เมนูหลัก" },
  { id: "menu_procurement", label: "การจัดซื้อวัตถุดิบ (Procurement)", category: "เมนูหลัก" },
  { id: "menu_products", label: "จัดการข้อมูลสินค้า", category: "เมนูหลัก" },
  { id: "menu_stocks", label: "จัดการสต็อกและวัตถุดิบ", category: "เมนูหลัก" },
  { id: "menu_employees", label: "จัดการข้อมูลพนักงาน", category: "เมนูหลัก" },
  { id: "menu_roles", label: "จัดการสิทธิ์และตำแหน่ง", category: "เมนูหลัก" },
  { id: "menu_reports", label: "ดูรายงานผลลัพธ์การขาย", category: "เมนูหลัก" },
  { id: "action_export_data", label: "Export ข้อมูลทำ Data Analysis (CSV)", category: "สิทธิ์เชิงลึก" },
  { id: "action_view_profit", label: "ดูสถิติกำไรและต้นทุนสินค้า", category: "สิทธิ์เชิงลึก" },
];

function RolesPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - roles: รายการตำแหน่งทั้งหมดจากฐานข้อมูล
  // - showModal: ควบคุมการแสดง Pop-up หน้าต่างเพิ่ม/แก้ไขสิทธิ์
  // - isEditing: ระบุสถานะว่ากำลังสร้างใหม่หรือแก้ไข
  // - formData: ข้อมูลตำแหน่ง (role_id, role_name, permissions)
  // ----------------------------------------------------------------------------
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    role_id: "",
    role_name: "",
    permissions: [],
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงข้อมูลตำแหน่งทั้งหมดจาก Backend
  // ----------------------------------------------------------------------------
  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ติ๊กเลือก / เอาออก สิทธิ์ทีละรายการใน Checkbox
  // ----------------------------------------------------------------------------
  const handleTogglePermission = (permId) => {
    const currentPerms = formData.permissions || [];
    if (currentPerms.includes(permId)) {
      setFormData({
        ...formData,
        permissions: currentPerms.filter((id) => id !== permId),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...currentPerms, permId],
      });
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ปุ่มลัดเลือกทุกสิทธิ์
  // ----------------------------------------------------------------------------
  const handleSelectAllPermissions = () => {
    setFormData({
      ...formData,
      permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
    });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ปุ่มลัดล้างสิทธิ์ทั้งหมด
  // ----------------------------------------------------------------------------
  const handleClearAllPermissions = () => {
    setFormData({
      ...formData,
      permissions: [],
    });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: สร้างรหัส role_id ถัดไปให้อัตโนมัติ (Auto-increment Next ID)
  // ----------------------------------------------------------------------------
  const generateNextRoleId = () => {
    if (roles.length === 0) return 1;
    const maxId = Math.max(...roles.map((r) => parseInt(r.role_id, 10)));
    return maxId + 1;
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปิดหน้าต่างสร้างตำแหน่งใหม่
  // ----------------------------------------------------------------------------
  const handleAddClick = () => {
    setIsEditing(false);
    setFormData({
      role_id: generateNextRoleId(),
      role_name: "",
      permissions: ["menu_pos"], // ให้สิทธิ์ POS เป็นค่าเริ่มต้น
    });
    setShowModal(true);
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปิดหน้าต่างแก้ไขตำแหน่งและสิทธิ์เดิม
  // ----------------------------------------------------------------------------
  const handleEditClick = (role) => {
    setIsEditing(true);
    let perms = role.permissions;
    if (typeof perms === "string") {
      try {
        perms = JSON.parse(perms);
      } catch (e) {
        perms = [];
      }
    }
    if (!Array.isArray(perms)) {
      perms = role.role_id === 1 ? AVAILABLE_PERMISSIONS.map((p) => p.id) : ["menu_pos"];
    }

    setFormData({
      role_id: role.role_id,
      role_name: role.role_name,
      permissions: perms,
    });
    setShowModal(true);
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: บันทึกข้อมูลตำแหน่ง (ยิง POST หรือ PUT ไปยัง /api/roles)
  // ----------------------------------------------------------------------------
  const handleSaveRole = async (e) => {
    e.preventDefault();
    const url = isEditing
      ? `/api/roles/${formData.role_id}`
      : "/api/roles";
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: isEditing ? "แก้ไขสำเร็จ!" : "เพิ่มตำแหน่งสำเร็จ!",
          showConfirmButton: false,
          timer: 1500,
        });
        setShowModal(false);
        fetchRoles();
      } else {
        const result = await response.json();
        Swal.fire("ผิดพลาด", result.message, "error");
      }
    } catch (error) {
      Swal.fire("ผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ลบตำแหน่ง (ป้องกันไม่ให้ลบ Admin role_id = 1)
  // ----------------------------------------------------------------------------
  const handleDelete = (id, roleName) => {
    if (Number(id) === 1) {
      Swal.fire("ไม่อนุญาต", "ไม่สามารถลบตำแหน่ง Admin หลักของระบบได้", "warning");
      return;
    }

    Swal.fire({
      title: "ยืนยันการลบ?",
      text: `คุณต้องการลบตำแหน่ง "${roleName}" ใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e74c3c",
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "ยืนยันการลบ",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`/api/roles/${id}`, { method: "DELETE" });
          if (response.ok) {
            Swal.fire("ลบสำเร็จ!", "ตำแหน่งถูกลบแล้ว", "success");
            fetchRoles();
          } else {
            const resData = await response.json();
            Swal.fire("ไม่สามารถลบได้!", resData.message, "error");
          }
        } catch (error) {
          Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดในการลบข้อมูล", "error");
        }
      }
    });
  };

  // กำหนดคลาสสี Badge ตามรหัสตำแหน่ง
  const getBadgeClass = (id) => {
    if (Number(id) === 1) return "roles-role-admin";
    if (Number(id) === 2) return "roles-role-cashier";
    return "roles-role-other";
  };

  // แปลง permission id ให้เป็นข้อความภาษาไทย
  const getPermissionLabel = (permId) => {
    const found = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
    return found ? found.label : permId;
  };

  return (
    <div className="roles-page-container">
      {/* ส่วนหัวหน้าจอจัดการสิทธิ์ */}
      <div className="roles-header">
        <div>
          <h2>จัดการสิทธิ์และบทบาท (Roles & Permissions)</h2>
          <p className="roles-subtitle">
            กำหนดบทบาทและสิทธิ์การเข้าถึงเมนู เพื่อความปลอดภัยและการบริหารงานที่มีประสิทธิภาพ
          </p>
        </div>
        <button className="btn-add-role" onClick={handleAddClick}>
          <FaPlus /> เพิ่มตำแหน่งใหม่
        </button>
      </div>

      {/* ตารางแสดงตำแหน่งและสิทธิ์การใช้งาน */}
      <div className="roles-table-container">
        <table className="roles-table">
          <thead>
            <tr>
              <th style={{ width: "12%" }}>รหัสตำแหน่ง (ID)</th>
              <th style={{ width: "20%" }}>ชื่อตำแหน่ง</th>
              <th style={{ width: "56%" }}>สิทธิ์การใช้งานที่ได้รับ (Permissions)</th>
              <th style={{ width: "12%", textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {roles.length > 0 ? (
              roles.map((role) => {
                let perms = role.permissions;
                if (typeof perms === "string") {
                  try {
                    perms = JSON.parse(perms);
                  } catch (e) {
                    perms = [];
                  }
                }
                const permsList = Array.isArray(perms) ? perms : (role.role_id === 1 ? AVAILABLE_PERMISSIONS.map(p => p.id) : []);

                return (
                  <tr key={role.role_id}>
                    <td style={{ fontWeight: "bold" }}>{role.role_id}</td>
                    <td>
                      <span className={`roles-role-badge ${getBadgeClass(role.role_id)}`}>
                        {role.role_name}
                      </span>
                    </td>
                    <td>
                      <div className="roles-permissions-tags">
                        {Number(role.role_id) === 1 ? (
                          <span className="perm-tag perm-tag-all">
                            <FaShieldAlt /> สิทธิ์สูงสุด (เข้าถึงได้ทุกส่วนของระบบ)
                          </span>
                        ) : permsList.length > 0 ? (
                          permsList.map((pId) => (
                            <span key={pId} className="perm-tag">
                              {getPermissionLabel(pId)}
                            </span>
                          ))
                        ) : (
                          <span className="perm-tag-none">ยังไม่ได้กำหนดสิทธิ์</span>
                        )}
                      </div>
                    </td>
                    <td className="roles-action-buttons">
                      <button
                        className="role-btn-edit"
                        onClick={() => handleEditClick(role)}
                        title="แก้ไขสิทธิ์"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="role-btn-delete"
                        onClick={() => handleDelete(role.role_id, role.role_name)}
                        title="ลบ"
                        disabled={Number(role.role_id) === 1}
                        style={Number(role.role_id) === 1 ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="4"
                  style={{
                    textAlign: "center",
                    color: "#adb5bd",
                    padding: "40px",
                  }}
                >
                  ไม่พบข้อมูลตำแหน่ง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal หน้าต่าง Pop-up กำหนดสิทธิ์ */}
      {showModal && (
        <div className="roles-modal-overlay">
          <div className="roles-modal-box roles-modal-box-large">
            <div className="roles-modal-header">
              <div>
                <h3>{isEditing ? `แก้ไขสิทธิ์: ${formData.role_name}` : "เพิ่มตำแหน่งและกำหนดสิทธิ์"}</h3>
                <p className="modal-subtext">เลือกสิทธิ์ที่ต้องการให้ตำแหน่งนี้เข้าถึงได้</p>
              </div>
              <button
                className="roles-close-btn"
                onClick={() => setShowModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveRole}>
              <div className="roles-form-row">
                <div className="roles-form-group" style={{ flex: "0 0 120px" }}>
                  <label>รหัสตำแหน่ง</label>
                  <input
                    type="text"
                    value={formData.role_id}
                    readOnly
                    style={{
                      backgroundColor: "#f1f3f5",
                      cursor: "not-allowed",
                      color: "#6c757d",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  />
                </div>

                <div className="roles-form-group" style={{ flex: 1 }}>
                  <label>ชื่อตำแหน่ง / บทบาท</label>
                  <input
                    type="text"
                    name="role_name"
                    value={formData.role_name}
                    onChange={handleInputChange}
                    required
                    placeholder="เช่น Store Manager, Cashier, Data Analyst"
                  />
                </div>
              </div>

              {/* ส่วนกำหนดสิทธิ์ Permissions Checkbox List */}
              <div className="permissions-selector-section">
                <div className="permissions-selector-header">
                  <label className="section-label">สิทธิ์การเข้าถึง (Permissions)</label>
                  <div className="perm-quick-actions">
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={handleSelectAllPermissions}
                    >
                      เลือกทั้งหมด
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={handleClearAllPermissions}
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                </div>

                <div className="permissions-grid">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = (formData.permissions || []).includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        className={`permission-item-card ${isChecked ? "selected" : ""}`}
                        onClick={() => handleTogglePermission(perm.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // ควบคุมผ่าน card onClick
                        />
                        <div className="perm-item-content">
                          <span className="perm-item-title">{perm.label}</span>
                          <span className="perm-item-category">{perm.category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="roles-modal-footer">
                <button
                  type="button"
                  className="roles-btn-cancel"
                  onClick={() => setShowModal(false)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="roles-btn-confirm">
                  บันทึกข้อมูลและสิทธิ์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RolesPage;

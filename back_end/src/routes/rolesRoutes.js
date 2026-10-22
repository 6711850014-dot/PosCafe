// ==============================================================================
// ไฟล์: back_end/src/routes/rolesRoutes.js
// ระบบ: การจัดการตำแหน่งและสิทธิ์การใช้งาน (Dynamic Roles & Granular Permissions - RBAC)
// หน้าที่:
//   1. CRUD ข้อมูลตำแหน่ง (Roles) ในระบบ
//   2. เก็บสิทธิ์ (Permissions) ในรูปแบบ JSONB เพื่อความยืดหยุ่นและรองรับสิทธิ์แบบไม่จำกัด
//   3. ป้องกันการลบตำแหน่งที่มีพนักงานใช้อยู่ (Foreign Key Constraint 23503)
//   4. ป้องกันการสร้างรหัสหรือชื่อตำแหน่งซ้ำ (Unique Constraint 23505)
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db'); 

// ------------------------------------------------------------------------------
// 1. GET /api/roles
// คำอธิบาย: ดึงรายชื่อตำแหน่งทั้งหมด พร้อมสิทธิ์ permissions ที่แต่ละตำแหน่งได้รับ
// ผลลัพธ์: [{ role_id, role_name, permissions: ['menu_pos', 'menu_delivery', ...] }]
// ------------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY role_id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่ง' });
  }
});

// ------------------------------------------------------------------------------
// 2. POST /api/roles
// คำอธิบาย: เพิ่มตำแหน่งงานใหม่ พร้อมกำหนดสิทธิ์ permissions (เก็บเป็น JSONB)
// Request Body:
//   - role_id: รหัสตัวเลขของตำแหน่ง (เช่น 4, 5)
//   - role_name: ชื่อตำแหน่ง (เช่น 'บาริสต้า', 'ผู้ช่วยผู้จัดการ')
//   - permissions: Array ของ string รหัสสิทธิ์ เช่น ['menu_pos', 'menu_stocks']
// ------------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { role_id, role_name, permissions } = req.body;
  try {
    const permsJson = JSON.stringify(permissions || []);
    // แปลงสตริง JSON เข้าสู่คอลัมน์ permissions ด้วย Type Cast `::jsonb`
    const query = `INSERT INTO roles (role_id, role_name, permissions) VALUES ($1, $2, $3::jsonb) RETURNING *`;
    await pool.query(query, [role_id, role_name, permsJson]);
    res.status(201).json({ message: 'เพิ่มตำแหน่งสำเร็จ' });
  } catch (error) {
    console.error('Error creating role:', error);
    // ดักจับ Error รหัส 23505: Unique Violation (รหัสหรือชื่อซ้ำ)
    if (error.code === '23505') {
      return res.status(400).json({ message: 'รหัสตำแหน่ง หรือ ชื่อตำแหน่ง นี้มีในระบบแล้ว' });
    }
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล' });
  }
});

// ------------------------------------------------------------------------------
// 3. PUT /api/roles/:id
// คำอธิบาย: แก้ไขชื่อตำแหน่ง หรือปรับเปลี่ยนสิทธิ์ permissions ของตำแหน่งนั้น
// ------------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { role_name, permissions } = req.body;
  try {
    const permsJson = JSON.stringify(permissions || []);
    const query = `UPDATE roles SET role_name=$1, permissions=$2::jsonb WHERE role_id=$3`;
    await pool.query(query, [role_name, permsJson, id]);
    res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
  }
});

// ------------------------------------------------------------------------------
// 4. DELETE /api/roles/:id
// คำอธิบาย: ลบตำแหน่งที่ไม่ต้องการ
// ความปลอดภัย:
//   - ดัก Error รหัส 23503 (Foreign Key Violation) เพื่อไม่ให้ลบตำแหน่งที่ยังมีพนักงานผูกอยู่
// ------------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM roles WHERE role_id = $1', [id]);
    res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error deleting role:', error);
    if (error.code === '23503') {
      return res.status(400).json({ message: 'ไม่สามารถลบได้ เนื่องจากยังมีพนักงานที่ใช้ตำแหน่งนี้อยู่!' });
    }
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

module.exports = router;

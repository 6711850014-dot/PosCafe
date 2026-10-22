// ==============================================================================
// ไฟล์: back_end/src/routes/authRoutes.js
// ระบบ: การยืนยันตัวตนและตรวจสอบสิทธิ์ (Authentication & Authorization)
// หน้าที่:
//   1. ตรวจสอบชื่อผู้ใช้ (username) และรหัสผ่าน (password) จากตาราง `employee`
//   2. ดึงสิทธิ์ permissions (JSONB) ของ Role ประจำตัวผู้ใช้นั้นออกมา
//   3. ส่งก้อนข้อมูลผู้ใช้และรายการสิทธิ์กลับไปเก็บใน Client Session (sessionStorage)
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// POST /api/auth/login
// คำอธิบาย: ตรวจสอบการเข้าสู่ระบบ
// Request Body:
//   - username: ชื่อผู้ใช้งาน
//   - password: รหัสผ่าน
// ------------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // ค้นหาข้อมูลพนักงาน พร้อม JOIN ตาราง roles เพื่อดึง role_name และ permissions
    const query = `
      SELECT 
        e.employee_id, 
        e.username, 
        e.password, 
        e.first_name, 
        e.last_name, 
        e.role_id, 
        r.role_name, 
        r.permissions 
      FROM employee e
      JOIN roles r ON e.role_id = r.role_id
      WHERE e.username = $1 AND e.is_active = TRUE
    `;
    const result = await pool.query(query, [username]);

    // หากไม่พบผู้ใช้ หรือผู้ใช้ถูกระงับสิทธิ์ (is_active = FALSE)
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'ไม่พบชื่อผู้ใช้งานนี้ หรือบัญชีถูกระงับการใช้งาน' });
    }

    const user = result.rows[0];

    // ตรวจสอบความถูกต้องของรหัสผ่าน
    if (password !== user.password) {
      return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // กรณี Admin (role_id = 1) หากยังไม่มีสิทธิ์ใน DB ให้กำหนดสิทธิ์ครอบคลุมทุกเมนูเป็น Fallback
    let permissions = user.permissions || [];
    if (user.role_id === 1 && (!permissions || permissions.length === 0)) {
      permissions = [
        'menu_pos',
        'menu_delivery',
        'menu_promotions',
        'menu_procurement',
        'menu_products',
        'menu_stocks',
        'menu_employees',
        'menu_roles',
        'menu_reports',
        'action_export_data',
        'action_view_profit'
      ];
    }

    // ส่งข้อมูลผู้ใช้พร้อมรายการสิทธิ์ที่ได้รับกลับไปให้หน้าเว็บ
    res.status(200).json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        employee_id: user.employee_id,
        username: user.username,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role_name,
        role_id: user.role_id,
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

module.exports = router;

// ==============================================================================
// ไฟล์: back_end/src/routes/promotionRoutes.js
// ระบบ: การจัดการโปรโมชั่น (Promotion Management API)
// หน้าที่:
//   1. จัดการข้อมูลโปรโมชั่นส่วนลดแบบรายเมนูเป็นเปอร์เซ็นต์ (%) (CRUD)
//   2. จัดการความสัมพันธ์ระหว่างโปรโมชั่นกับสินค้าที่ร่วมรายการ (ตาราง promotion_products)
//   3. ให้บริการ Endpoint `/active` สำหรับระบบ POS ใช้คำนวณราคาพิเศษอัตโนมัติ
//   4. ตรวจสอบวันหมดอายุ (Start Date / End Date) และสวิตช์เปิด-ปิดการใช้งาน
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// 1. GET /api/promotions
// คำอธิบาย: ดึงโปรโมชั่นทั้งหมด พร้อมรายการสินค้าที่ผูกอยู่กับแต่ละโปรโมชั่น
// จุดเด่นของ Query นี้:
//   - ใช้ CASE WHEN ตรวจสอบว่าโปรโมชั่น 'EXPIRED' (หมดอายุตามวันที่) หรือ 'DISABLED' (ปิดสวิตช์) หรือ 'ACTIVE'
//   - ใช้ json_agg(...) ร่วมกับ FILTER (WHERE p.product_id IS NOT NULL) เพื่อดึงสินค้าที่ร่วมรายการ
//     ออกมาเป็น Array ซ้อนอยู่ในแต่ละโปรโมชั่นทันที
// ------------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        pr.promotion_id,
        pr.promotion_name,
        pr.description,
        pr.discount_percentage,
        TO_CHAR(pr.start_date, 'YYYY-MM-DD') AS start_date,
        TO_CHAR(pr.end_date, 'YYYY-MM-DD') AS end_date,
        pr.is_active,
        pr.created_at,
        -- ตรวจสอบสถานะความพร้อมใช้งานแบบไดนามิก
        CASE 
          WHEN CURRENT_DATE > pr.end_date THEN 'EXPIRED'
          WHEN NOT pr.is_active THEN 'DISABLED'
          ELSE 'ACTIVE'
        END AS status,
        -- ดึงรายชื่อสินค้าที่ร่วมรายการเป็น JSON Array
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.product_id, 
              'product_name', p.product_name, 
              'price', p.price
            )
          ) FILTER (WHERE p.product_id IS NOT NULL), '[]'::json
        ) AS products
      FROM promotions pr
      LEFT JOIN promotion_products pp ON pr.promotion_id = pp.promotion_id
      LEFT JOIN products p ON pp.product_id = p.product_id
      GROUP BY pr.promotion_id
      ORDER BY pr.promotion_id DESC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรโมชั่น' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/promotions/active
// คำอธิบาย: ดึงโปรโมชั่นที่มีผลบังคับใช้ในวันนี้ (CURRENT_DATE อยู่ระหว่าง start_date ถึง end_date)
// วัตถุประสงค์: หน้า POS จะยิง API นี้ตอนเปิดเครื่อง เพื่อนำไปจับคู่กับเมนูและคำนวณส่วนลดอัตโนมัติ
// การคำนวณ:
//   discounted_price = ROUND(p.price * (1 - pr.discount_percentage / 100), 2)
// ------------------------------------------------------------------------------
router.get('/active', async (req, res) => {
  try {
    const query = `
      SELECT 
        pr.promotion_id,
        pr.promotion_name,
        pr.discount_percentage,
        pp.product_id,
        p.product_name,
        p.price AS original_price,
        ROUND(p.price * (1 - pr.discount_percentage / 100), 2) AS discounted_price
      FROM promotions pr
      JOIN promotion_products pp ON pr.promotion_id = pp.promotion_id
      JOIN products p ON pp.product_id = p.product_id
      WHERE pr.is_active = TRUE
        AND CURRENT_DATE >= pr.start_date
        AND CURRENT_DATE <= pr.end_date
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching active promotions:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงโปรโมชั่นที่เปิดใช้งาน' });
  }
});

// ------------------------------------------------------------------------------
// 3. POST /api/promotions
// คำอธิบาย: สร้างโปรโมชั่นใหม่ และผูกรายการสินค้าที่ร่วมรายการ
// Request Body:
//   - promotion_name: ชื่อโปรโมชั่น
//   - description: รายละเอียดเงื่อนไข
//   - discount_percentage: เปอร์เซ็นต์ส่วนลด (เช่น 10, 15, 20)
//   - start_date, end_date: วันที่เริ่มต้นและสิ้นสุด
//   - product_ids: Array ของ product_id เช่น [1, 2, 5]
// ------------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { promotion_name, description, discount_percentage, start_date, end_date, product_ids } = req.body;
  
  if (!promotion_name || !discount_percentage || !start_date || !end_date) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลโปรโมชั่นให้ครบถ้วน' });
  }

  try {
    await pool.query('BEGIN'); // เริ่ม Transaction บันทึก 2 ตารางพร้อมกัน

    // 1. บันทึกข้อมูลโปรโมชั่นหลัก
    const promoRes = await pool.query(
      `INSERT INTO promotions (promotion_name, description, discount_percentage, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING promotion_id`,
      [promotion_name, description || '', discount_percentage, start_date, end_date]
    );
    const newPromoId = promoRes.rows[0].promotion_id;

    // 2. บันทึกรายการสินค้าที่ร่วมรายการลงตารางเชื่อม (promotion_products)
    if (Array.isArray(product_ids) && product_ids.length > 0) {
      for (const prodId of product_ids) {
        await pool.query(
          `INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newPromoId, prodId]
        );
      }
    }

    await pool.query('COMMIT');
    res.status(201).json({ message: 'สร้างโปรโมชั่นสำเร็จ!', promotion_id: newPromoId });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error creating promotion:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกโปรโมชั่น' });
  }
});

// ------------------------------------------------------------------------------
// 4. PUT /api/promotions/:id
// คำอธิบาย: แก้ไขข้อมูลโปรโมชั่น และอัปเดตรายการสินค้าที่ร่วมรายการใหม่
// ------------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { promotion_name, description, discount_percentage, start_date, end_date, is_active, product_ids } = req.body;

  try {
    await pool.query('BEGIN');

    // 1. อัปเดตข้อมูลโปรโมชั่นหลัก
    await pool.query(
      `UPDATE promotions 
       SET promotion_name = $1, description = $2, discount_percentage = $3, start_date = $4, end_date = $5, is_active = $6
       WHERE promotion_id = $7`,
      [promotion_name, description, discount_percentage, start_date, end_date, is_active, id]
    );

    // 2. เคลียร์รายการสินค้าเดิม แล้วใส่รายการสินค้าใหม่เข้าไปแทน
    if (Array.isArray(product_ids)) {
      await pool.query('DELETE FROM promotion_products WHERE promotion_id = $1', [id]);
      for (const prodId of product_ids) {
        await pool.query(
          `INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, prodId]
        );
      }
    }

    await pool.query('COMMIT');
    res.status(200).json({ message: 'อัปเดตโปรโมชั่นสำเร็จ' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating promotion:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขโปรโมชั่น' });
  }
});

// ------------------------------------------------------------------------------
// 5. PUT /api/promotions/:id/toggle
// คำอธิบาย: สลับสถานะเปิด/ปิดโปรโมชั่น (Toggle Active/Inactive) โดยไม่ต้องเข้าหน้าแก้ไข
// ใช้ SQL: is_active = NOT is_active
// ------------------------------------------------------------------------------
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE promotions SET is_active = NOT is_active WHERE promotion_id = $1 RETURNING is_active`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'ไม่พบโปรโมชั่น' });
    res.status(200).json({ 
      message: 'เปลี่ยนสถานะโปรโมชั่นสำเร็จ', 
      is_active: result.rows[0].is_active 
    });
  } catch (error) {
    console.error('Error toggling promotion:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ' });
  }
});

// ------------------------------------------------------------------------------
// 6. DELETE /api/promotions/:id
// คำอธิบาย: ลบโปรโมชั่น (ตาราง promotion_products จะถูก CASCADE ลบไปด้วย)
// ------------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM promotions WHERE promotion_id = $1', [id]);
    res.status(200).json({ message: 'ลบโปรโมชั่นสำเร็จ' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบโปรโมชั่น' });
  }
});

module.exports = router;

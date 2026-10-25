// ==============================================================================
// ไฟล์: back_end/src/routes/promotionRoutes.js
// ระบบ: การจัดการโปรโมชั่น (Promotion Management API)
// หน้าที่:
//   1. จัดการข้อมูลโปรโมชั่นส่วนลดแบบรายเมนูเป็นเปอร์เซ็นต์ (%) (CRUD)
//   2. จัดการความสัมพันธ์ระหว่างโปรโมชั่นกับสินค้าที่ร่วมรายการ (ตาราง promotion_products)
//   3. ให้บริการ Endpoint `/active` สำหรับระบบ POS ใช้คำนวณราคาพิเศษอัตโนมัติ
//   4. ตรวจสอบวันหมดอายุ (Start Date / End Date) และสวิตช์เปิด-ปิดการใช้งาน
//   5. ตรวจสอบป้องกันโปรโมชั่นที่ชื่อเหมือนกัน + ช่วงเวลาเหมือนกัน + ส่วนลดเท่ากัน (Exact Duplicate)
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// 1. GET /api/promotions
// คำอธิบาย: ดึงโปรโมชั่นทั้งหมด พร้อมรายการสินค้าที่ผูกอยู่กับแต่ละโปรโมชั่น
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
        CASE 
          WHEN NOT pr.is_active THEN 'DISABLED'
          WHEN CURRENT_DATE > pr.end_date THEN 'EXPIRED'
          WHEN CURRENT_DATE < pr.start_date THEN 'UPCOMING'
          ELSE 'ACTIVE'
        END AS status,
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
// คำอธิบาย: ดึงโปรโมชั่นที่มีผลบังคับใช้ในวันนี้
// ใช้ DISTINCT ON (pp.product_id) เพื่อให้สินค้าแต่ละตัวใช้ส่วนลดที่ดีที่สุดเพียงรายการเดียว
// ------------------------------------------------------------------------------
router.get('/active', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (pp.product_id)
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
      ORDER BY pp.product_id, pr.discount_percentage DESC, pr.promotion_id DESC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching active promotions:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงโปรโมชั่นที่เปิดใช้งาน' });
  }
});

// ------------------------------------------------------------------------------
// Helper: ตรวจสอบว่ามีโปรโมชั่นที่ "ซ้ำเหมือนกันทั้งหมด" หรือไม่
//   เงื่อนไข "ซ้ำ" = ชื่อเหมือนกัน AND เปอร์เซ็นต์ลดเท่ากัน AND ช่วงวันที่ทับซ้อนกัน
//   บล็อกเฉพาะกรณีนี้เท่านั้น (Exact Duplicate Prevention)
//   ส่วนสินค้าซ้อนทับจะเป็นแค่ "เตือน" บน Frontend ไม่บล็อกที่ Backend
// ------------------------------------------------------------------------------
async function checkExactDuplicate(promoId, name, discountPct, startDate, endDate) {
  const query = `
    SELECT 
      promotion_id, 
      promotion_name, 
      discount_percentage,
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
      TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
    FROM promotions
    WHERE LOWER(TRIM(promotion_name)) = LOWER(TRIM($1))
      AND discount_percentage = $2
      AND ($3::date <= end_date AND $4::date >= start_date)
      ${promoId ? 'AND promotion_id != $5' : ''}
  `;
  const params = promoId
    ? [name.trim(), discountPct, startDate, endDate, promoId]
    : [name.trim(), discountPct, startDate, endDate];

  const result = await pool.query(query, params);

  if (result.rows.length > 0) {
    const dup = result.rows[0];
    return {
      isDuplicate: true,
      message: `พบโปรโมชั่นที่ซ้ำกันทั้งหมดในระบบ: "${dup.promotion_name}" (รหัส #PR-${dup.promotion_id}, ลด ${dup.discount_percentage}%, ช่วง ${dup.start_date} ถึง ${dup.end_date}) กรุณาเปลี่ยนชื่อ หรือเปอร์เซ็นต์ลด หรือช่วงเวลาให้แตกต่างอย่างน้อย 1 อย่าง`
    };
  }

  return { isDuplicate: false };
}

// ------------------------------------------------------------------------------
// 3. POST /api/promotions
// คำอธิบาย: สร้างโปรโมชั่นใหม่ และผูกรายการสินค้าที่ร่วมรายการ
// การตรวจสอบ: บล็อกเฉพาะกรณีซ้ำเหมือนกันทั้งหมด (ชื่อ + % + ช่วงเวลา)
// ------------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { promotion_name, description, discount_percentage, start_date, end_date, product_ids } = req.body;
  
  if (!promotion_name || !discount_percentage || !start_date || !end_date) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลโปรโมชั่นให้ครบถ้วน' });
  }

  const numDiscount = Number(discount_percentage);
  if (isNaN(numDiscount) || numDiscount <= 0 || numDiscount > 100) {
    return res.status(400).json({ message: 'เปอร์เซ็นต์ส่วนลดต้องอยู่ระหว่าง 1 ถึง 100%' });
  }

  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น' });
  }

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return res.status(400).json({ message: 'กรุณาเลือกสินค้าที่ต้องการลดราคาอย่างน้อย 1 รายการ' });
  }

  try {
    // ตรวจสอบเฉพาะ Exact Duplicate: ชื่อเดียวกัน + %เท่ากัน + ช่วงเวลาทับซ้อนกัน
    const dupCheck = await checkExactDuplicate(null, promotion_name, numDiscount, start_date, end_date);
    if (dupCheck.isDuplicate) {
      return res.status(400).json({ message: dupCheck.message });
    }

    await pool.query('BEGIN');

    // 1. บันทึกข้อมูลโปรโมชั่นหลัก
    const promoRes = await pool.query(
      `INSERT INTO promotions (promotion_name, description, discount_percentage, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING promotion_id`,
      [promotion_name.trim(), description || '', numDiscount, start_date, end_date]
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

  if (!promotion_name || !discount_percentage || !start_date || !end_date) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลโปรโมชั่นให้ครบถ้วน' });
  }

  const numDiscount = Number(discount_percentage);
  if (isNaN(numDiscount) || numDiscount <= 0 || numDiscount > 100) {
    return res.status(400).json({ message: 'เปอร์เซ็นต์ส่วนลดต้องอยู่ระหว่าง 1 ถึง 100%' });
  }

  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น' });
  }

  try {
    // ตรวจสอบเฉพาะ Exact Duplicate (ข้ามตัวเองที่กำลังแก้ไข)
    const dupCheck = await checkExactDuplicate(id, promotion_name, numDiscount, start_date, end_date);
    if (dupCheck.isDuplicate) {
      return res.status(400).json({ message: dupCheck.message });
    }

    await pool.query('BEGIN');

    // 1. อัปเดตข้อมูลโปรโมชั่นหลัก
    await pool.query(
      `UPDATE promotions 
       SET promotion_name = $1, description = $2, discount_percentage = $3, start_date = $4, end_date = $5, is_active = $6
       WHERE promotion_id = $7`,
      [promotion_name.trim(), description || '', numDiscount, start_date, end_date, is_active, id]
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

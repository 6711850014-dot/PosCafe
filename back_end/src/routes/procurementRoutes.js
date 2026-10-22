// ==============================================================================
// ไฟล์: back_end/src/routes/procurementRoutes.js
// ระบบ: การจัดซื้อวัตถุดิบ (Material Procurement & Simple Receiving)
// หน้าที่:
//   1. บันทึกรับวัตถุดิบเข้าสต็อก (Simple Receiving) เชื่อมโยงกับระบบสต็อกแบบ FIFO
//   2. สร้างล็อตวัตถุดิบใหม่ลงตาราง `inventory` ทันทีเพื่อให้หน้าร้านพร้อมชงขาย
//   3. เก็บประวัติการซื้อลงตาราง `material_procurement` เพื่อบันทึกต้นทุน, คู่ค้า (Supplier), และเลขที่บิล
//   4. ให้บริการข้อมูลสรุปภาพรวมค่าใช้จ่ายจัดซื้อวัตถุดิบ (Procurement Analytics)
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// 1. GET /api/procurements
// คำอธิบาย: ดึงประวัติการจัดซื้อวัตถุดิบทั้งหมด รองรับการกรองตามวัตถุดิบและช่วงวันที่
// Query Parameters:
//   - ingredient_id: รหัสวัตถุดิบที่ต้องการดูประวัติ
//   - startDate, endDate: ช่วงวันที่ต้องการดูข้อมูล
// ------------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, ingredient_id } = req.query;

    // เชื่อมตาราง material_procurement เข้ากับ ingredients (เพื่อเอาชื่อและหน่วยนับ)
    // และ employee (เพื่อเอาชื่อพนักงานผู้รับของ)
    let query = `
      SELECT 
        mp.procurement_id,
        mp.supplier_name,
        mp.ingredient_id,
        i.ingredient_name,
        i.unit,
        mp.quantity,
        mp.unit_cost,
        mp.total_cost,
        TO_CHAR(mp.purchase_date, 'YYYY-MM-DD') AS purchase_date,
        TO_CHAR(mp.expiration_date, 'YYYY-MM-DD') AS expiration_date,
        mp.invoice_number,
        mp.notes,
        mp.received_by,
        COALESCE(e.first_name || ' ' || e.last_name, mp.received_by) AS receiver_name,
        mp.inventory_id,
        mp.created_at
      FROM material_procurement mp
      JOIN ingredients i ON mp.ingredient_id = i.ingredient_id
      LEFT JOIN employee e ON mp.received_by = e.employee_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // กรองตามวัตถุดิบ
    if (ingredient_id && ingredient_id !== 'ALL') {
      query += ` AND mp.ingredient_id = $${idx}`;
      params.push(ingredient_id);
      idx++;
    }

    // กรองตามช่วงวันที่ซื้อ
    if (startDate && endDate) {
      query += ` AND mp.purchase_date >= $${idx} AND mp.purchase_date <= $${idx + 1}`;
      params.push(startDate, endDate);
      idx += 2;
    }

    query += ` ORDER BY mp.purchase_date DESC, mp.procurement_id DESC`;

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching procurements:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจัดซื้อ' });
  }
});

// ------------------------------------------------------------------------------
// 2. POST /api/procurements
// คำอธิบาย: บันทึกรับวัตถุดิบเข้าสต็อก (Simple Receiving)
// กลไกการทำงานสำคัญ:
//   - ใช้ Database Transaction (BEGIN ... COMMIT)
//   - ขั้นที่ 1: สร้างแถวใหม่ในตาราง `inventory` ทันที โดยบันทึก purchase_date และ expiration_date 
//              เพื่อให้สูตรการตัดสต็อกแบบ FIFO ในหน้าขายสามารถนำไปตัดใช้งานได้ทันที
//   - ขั้นที่ 2: นำ `inventory_id` ที่ได้ ไปบันทึกลงตาราง `material_procurement`
//              พร้อมบันทึกชื่อผู้ขาย ราคาต่อหน่วย ยอดเงินรวม และผู้ตรวจรับ
// ------------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { 
    ingredient_id, 
    supplier_name, 
    quantity, 
    unit_cost, 
    total_cost, 
    purchase_date, 
    expiration_date, 
    invoice_number, 
    notes, 
    received_by 
  } = req.body;

  if (!ingredient_id || !quantity || !unit_cost) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลวัตถุดิบ จำนวน และราคาต่อหน่วยให้ครบถ้วน' });
  }

  const pDate = purchase_date || new Date().toISOString().slice(0, 10);
  const expDate = expiration_date || null;
  const calculatedTotal = total_cost || (parseFloat(quantity) * parseFloat(unit_cost));

  try {
    await pool.query('BEGIN');

    // 1. เพิ่มล็อตวัตถุดิบเข้าตาราง inventory ทันที เพื่อให้การขายและตัดสต็อก FIFO ใช้งานได้เลย
    const invRes = await pool.query(
      `INSERT INTO inventory (ingredient_id, quantity, purchase_date, expiration_date)
       VALUES ($1, $2, $3, $4) RETURNING inventory_id`,
      [ingredient_id, Math.round(parseFloat(quantity)), pDate, expDate]
    );
    const newInventoryId = invRes.rows[0].inventory_id;

    // 2. บันทึกลงตารางประวัติการจัดซื้อ material_procurement เพื่อใช้คุมต้นทุนและทำ Data Analysis
    const procRes = await pool.query(
      `INSERT INTO material_procurement 
       (supplier_name, ingredient_id, quantity, unit_cost, total_cost, purchase_date, expiration_date, invoice_number, notes, received_by, inventory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING procurement_id`,
      [
        supplier_name || 'ทั่วไป / ซื้อสด',
        ingredient_id,
        quantity,
        unit_cost,
        calculatedTotal,
        pDate,
        expDate,
        invoice_number || null,
        notes || null,
        received_by || null,
        newInventoryId
      ]
    );

    await pool.query('COMMIT');
    res.status(201).json({ 
      message: 'บันทึกรับวัตถุดิบเข้าสต็อกเรียบร้อยแล้ว!',
      procurement_id: procRes.rows[0].procurement_id,
      inventory_id: newInventoryId
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in procurement simple receiving:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกการจัดซื้อวัตถุดิบ' });
  }
});

// ------------------------------------------------------------------------------
// 3. GET /api/procurements/summary
// คำอธิบาย: สรุปภาพรวมค่าใช้จ่ายจัดซื้อวัตถุดิบ (Procurement Spend Analytics)
// สิ่งที่คำนวณ:
//   - overview: ยอดซื้อรวมทั้งหมด, ค่าเฉลี่ยต่อบิล
//   - ingredientSpend: 10 อันดับวัตถุดิบที่ร้านจ่ายเงินซื้อมากที่สุด
//   - supplierSpend: สัดส่วนรายจ่ายแยกตามคู่ค้า/ผู้ขาย
// ------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  try {
    // 3.1 ยอดรวมค่าใช้จ่ายทั้งหมด
    const totalRes = await pool.query(`
      SELECT 
        COUNT(procurement_id) AS total_orders,
        COALESCE(SUM(total_cost), 0) AS total_spend,
        COALESCE(ROUND(AVG(total_cost), 2), 0) AS avg_spend_per_purchase
      FROM material_procurement
    `);

    // 3.2 รายจ่ายแยกตามวัตถุดิบ (Top Ingredients Spend)
    const ingredientSpendRes = await pool.query(`
      SELECT 
        i.ingredient_id,
        i.ingredient_name,
        i.unit,
        SUM(mp.quantity) AS total_qty_purchased,
        SUM(mp.total_cost) AS total_spent
      FROM material_procurement mp
      JOIN ingredients i ON mp.ingredient_id = i.ingredient_id
      GROUP BY i.ingredient_id, i.ingredient_name, i.unit
      ORDER BY total_spent DESC
      LIMIT 10
    `);

    // 3.3 รายจ่ายแยกตามผู้ขาย/คู่ค้า (Supplier Breakdown)
    const supplierRes = await pool.query(`
      SELECT 
        COALESCE(supplier_name, 'ไม่ระบุ') AS supplier_name,
        COUNT(procurement_id) AS purchase_count,
        SUM(total_cost) AS total_amount
      FROM material_procurement
      GROUP BY supplier_name
      ORDER BY total_amount DESC
    `);

    res.status(200).json({
      overview: totalRes.rows[0],
      ingredientSpend: ingredientSpendRes.rows,
      supplierSpend: supplierRes.rows
    });
  } catch (error) {
    console.error('Error in procurement summary:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปการจัดซื้อ' });
  }
});

module.exports = router;

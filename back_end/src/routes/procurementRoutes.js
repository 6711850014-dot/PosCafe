const express = require('express');
const router = express.Router();
const pool = require('../../db');

// 1. GET /api/procurements (ดึงประวัติการจัดซื้อทั้งหมด)
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, ingredient_id } = req.query;
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
        mp.status,
        mp.created_at
      FROM material_procurement mp
      JOIN ingredients i ON mp.ingredient_id = i.ingredient_id
      LEFT JOIN employee e ON mp.received_by = e.employee_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (ingredient_id && ingredient_id !== 'ALL') {
      query += ` AND mp.ingredient_id = $${idx}`;
      params.push(ingredient_id);
      idx++;
    }
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

// 2. POST /api/procurements (เพิ่มข้อมูลจัดซื้อใหม่)
router.post('/', async (req, res) => {
  const { ingredient_id, supplier_name, quantity, unit_cost, total_cost, purchase_date, expiration_date, invoice_number, notes, received_by } = req.body;
  
  if (!ingredient_id || !quantity || !unit_cost) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลวัตถุดิบ จำนวน และราคาต่อหน่วยให้ครบถ้วน' });
  }

  const pDate = purchase_date || new Date().toISOString().slice(0, 10);
  const expDate = expiration_date || null;
  const calculatedTotal = total_cost || (parseFloat(quantity) * parseFloat(unit_cost));

  try {
    const procRes = await pool.query(
      `INSERT INTO material_procurement 
       (supplier_name, ingredient_id, quantity, unit_cost, total_cost, purchase_date, expiration_date, invoice_number, notes, received_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'รอรับของ') RETURNING procurement_id`,
      [supplier_name || 'ทั่วไป / ซื้อสด', ingredient_id, quantity, unit_cost, calculatedTotal, pDate, expDate, invoice_number || null, notes || null, received_by || null]
    );

    res.status(201).json({ 
      message: 'บันทึกใบสั่งซื้อสำเร็จ! โปรดไปรับของที่หน้าสต็อกเพื่อตัดยอด FIFO',
      procurement_id: procRes.rows[0].procurement_id
    });

  } catch (error) {
    console.error('Error in procurement:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกการจัดซื้อวัตถุดิบ' });
  }
});

// 3. PUT /api/procurements/:id (แก้ไขบิลจัดซื้อ - ดักสถานะห้ามแก้ถ้ารับเข้าแล้ว)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { ingredient_id, supplier_name, quantity, unit_cost, total_cost, purchase_date, expiration_date, invoice_number, notes } = req.body;

  try {
    const checkStatus = await pool.query('SELECT status FROM material_procurement WHERE procurement_id = $1', [id]);
    if (checkStatus.rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลบิลนี้' });
    if (checkStatus.rows[0].status === 'รับเข้าแล้ว') {
      return res.status(400).json({ message: 'ไม่สามารถแก้ไขได้ เนื่องจากรับของเข้าคลังสต็อกไปแล้ว' });
    }

    const calculatedTotal = total_cost || (parseFloat(quantity) * parseFloat(unit_cost));
    await pool.query(
      `UPDATE material_procurement 
       SET ingredient_id=$1, supplier_name=$2, quantity=$3, unit_cost=$4, total_cost=$5, purchase_date=$6, expiration_date=$7, invoice_number=$8, notes=$9
       WHERE procurement_id=$10`,
      [ingredient_id, supplier_name || 'ทั่วไป / ซื้อสด', quantity, unit_cost, calculatedTotal, purchase_date, expiration_date || null, invoice_number || null, notes || null, id]
    );
    res.status(200).json({ message: 'อัปเดตข้อมูลการจัดซื้อสำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating procurement' });
  }
});

// 4. DELETE /api/procurements/:id (ลบบิลจัดซื้อ - ดักสถานะห้ามลบถ้ารับเข้าแล้ว)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const checkStatus = await pool.query('SELECT status FROM material_procurement WHERE procurement_id = $1', [id]);
    if (checkStatus.rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลบิลนี้' });
    if (checkStatus.rows[0].status === 'รับเข้าแล้ว') {
      return res.status(400).json({ message: 'ไม่สามารถลบได้ เนื่องจากสินค้าถูกนำไปบวกในสต็อกแล้ว' });
    }

    await pool.query('DELETE FROM material_procurement WHERE procurement_id = $1', [id]);
    res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting procurement' });
  }
});

// 5. GET /api/procurements/pending/:id (API สำหรับดึงบิลที่รอรับของ ไปโชว์หน้าสต็อก)
router.get('/pending/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT procurement_id, supplier_name, quantity, TO_CHAR(purchase_date, 'DD/MM/YYYY') as p_date 
       FROM material_procurement 
       WHERE ingredient_id = $1 AND status = 'รอรับของ'
       ORDER BY purchase_date ASC`,
      [req.params.id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pending POs:', error);
    res.status(500).json({ message: 'Error fetching pending PO' });
  }
});

// 6. GET /api/procurements/summary (ดึงตัวเลข Dashboard)
router.get('/summary', async (req, res) => {
  try {
    const totalRes = await pool.query(`
      SELECT 
        COUNT(procurement_id) AS total_orders,
        COALESCE(SUM(total_cost), 0) AS total_spend,
        COALESCE(ROUND(AVG(total_cost), 2), 0) AS avg_spend_per_purchase
      FROM material_procurement
    `);
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
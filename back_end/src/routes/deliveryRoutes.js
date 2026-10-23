// ==============================================================================
// ไฟล์: back_end/src/routes/deliveryRoutes.js
// ระบบ: การจัดการจัดส่งสินค้า (Delivery Management) & Mobile Rider API
// หน้าที่: 
//   1. ให้บริการ API สำหรับหน้าจอแคชเชียร์/ผู้จัดการร้าน (Delivery Dashboard)
//   2. ให้บริการ API สำหรับหน้าจอมือถือของไรเดอร์ (Mobile-First Rider Interface)
//   3. อัปเดตสถานะการจัดส่ง บันทึกเวลาส่งมอบ (delivered_at) และมอบหมายไรเดอร์
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db'); // เชื่อมต่อ Supabase PostgreSQL ผ่าน connection pool

// ------------------------------------------------------------------------------
// 1. GET /api/deliveries
// คำอธิบาย: ดึงรายการจัดส่งทั้งหมด พร้อมรองรับการกรอง (Filter)
// Query Parameters ที่รองรับ:
//   - status: สถานะการจัดส่ง ('ALL', 'PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')
//   - rider_id: รหัสพนักงานส่งของ (เช่น 'E10') เพื่อดูเฉพาะงานของไรเดอร์คนนั้น
//   - date: วันที่สร้างรายการจัดส่ง (รูปแบบ 'YYYY-MM-DD')
// ผลลัพธ์: Array ของ Object ข้อมูลจัดส่ง ข้อมูลลูกค้า และรายละเอียดออเดอร์
// ------------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { status, rider_id, date } = req.query;

    // เตรียม SQL Query พื้นฐาน โดยเชื่อมโยง 3 ตาราง:
    // - deliveries (d): เก็บข้อมูลการจัดส่ง เช่น ที่อยู่, ค่าส่ง, สถานะ
    // - orders (o): เก็บยอดรวม, วิธีการชำระเงิน, วันเวลาสั่งซื้อ
    // - employee (e): เก็บชื่อ-นามสกุล และเบอร์โทรของไรเดอร์ที่ได้รับมอบหมาย
    let query = `
      SELECT 
        d.delivery_id,
        d.order_id,
        d.customer_name,
        d.customer_phone,
        d.delivery_address,
        d.delivery_fee,
        d.delivery_status,
        d.notes,
        d.created_at,
        d.delivered_at,
        d.rider_id,
        -- ใช้ COALESCE เพื่อให้กรณีที่ยังไม่ได้เลือกไรเดอร์ แสดงข้อความ 'ยังไม่มอบหมาย'
        COALESCE(e.first_name || ' ' || e.last_name, 'ยังไม่มอบหมาย') AS rider_name,
        e.phone AS rider_phone,
        o.total_amount,
        o.payment_method,
        COALESCE(o.payment_status, 'PAID') AS payment_status,
        COALESCE(o.order_status, 'COMPLETED') AS order_status,
        o.order_time
      FROM deliveries d
      JOIN orders o ON d.order_id = o.order_id
      LEFT JOIN employee e ON d.rider_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // กรองตามสถานะการจัดส่ง (ถ้าไม่ได้เลือก 'ALL')
    if (status && status !== 'ALL') {
      query += ` AND d.delivery_status = $${idx}`;
      params.push(status);
      idx++;
    }

    // กรองตามไรเดอร์
    if (rider_id) {
      query += ` AND d.rider_id = $${idx}`;
      params.push(rider_id);
      idx++;
    }

    // กรองตามวันที่จัดส่ง (ตัดเวลาออกโดยใช้ฟังก์ชัน DATE)
    if (date) {
      query += ` AND DATE(d.created_at) = $${idx}`;
      params.push(date);
      idx++;
    }

    // เรียงลำดับจากรายการใหม่สุดไปเก่าสุด
    query += ` ORDER BY d.delivery_id DESC`;

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจัดส่ง' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/deliveries/riders
// คำอธิบาย: ดึงรายชื่อพนักงานที่พร้อมปฏิบัติงาน (is_active = TRUE)
// วัตถุประสงค์: นำไปแสดงใน Dropdown สำหรับให้ผู้จัดการเลือกว่าจะส่งออเดอร์นี้ให้ไรเดอร์คนไหน
// ------------------------------------------------------------------------------
router.get('/riders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT employee_id, first_name, last_name, phone, role_id
      FROM employee
      WHERE is_active = TRUE
      ORDER BY first_name ASC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching riders:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไรเดอร์' });
  }
});

// ------------------------------------------------------------------------------
// 3. GET /api/deliveries/my-tasks/:riderId
// คำอธิบาย: ดึงรายการงานจัดส่งเฉพาะของไรเดอร์คนนั้น สำหรับหน้าจอมือถือ (Mobile-First)
// ความพิเศษของ Endpoint นี้:
//   - ใช้ subquery พร้อมคำสั่ง `json_agg(json_build_object(...))` ดึงรายการสินค้าทั้งหมดในออเดอร์นั้นออกมาเป็น JSON Array 
//     ทำให้ไรเดอร์เปิดดูในมือถือได้ทันทีว่าลูกค้าสั่งอะไรบ้าง จำนวนกี่ชิ้น โดยไม่ต้องยิง API หลายรอบ
//   - จัดลำดับงาน (ORDER BY CASE) ให้ออเดอร์ที่ 'กำลังจัดส่ง' (OUT_FOR_DELIVERY) ขึ้นก่อนเสมอ
//     ตามด้วย 'กำลังเตรียม' (PREPARING) และ 'รอดำเนินการ' (PENDING) เพื่อง่ายต่อการมองเห็นงานเร่งด่วนบนมือถือ
// ------------------------------------------------------------------------------
router.get('/my-tasks/:riderId', async (req, res) => {
  try {
    const { riderId } = req.params;
    const query = `
      SELECT 
        d.delivery_id,
        d.order_id,
        d.customer_name,
        d.customer_phone,
        d.delivery_address,
        d.delivery_fee,
        d.delivery_status,
        d.notes,
        d.created_at,
        d.delivered_at,
        o.total_amount,
        o.payment_method,
        COALESCE(o.payment_status, 'PAID') AS payment_status,
        COALESCE(o.order_status, 'COMPLETED') AS order_status,
        -- รวมรายการสินค้าของบิลนั้นเป็น JSON Array แนบไปกับแต่ละงาน
        (
          SELECT json_agg(json_build_object(
            'product_name', p.product_name,
            'quantity', oi.quantity,
            'price', oi.price
          ))
          FROM order_items oi
          JOIN products p ON oi.product_id = p.product_id
          WHERE oi.order_id = d.order_id
        ) AS items
      FROM deliveries d
      JOIN orders o ON d.order_id = o.order_id
      WHERE d.rider_id = $1
      ORDER BY 
        CASE 
          WHEN d.delivery_status = 'OUT_FOR_DELIVERY' THEN 1
          WHEN d.delivery_status = 'PREPARING' THEN 2
          WHEN d.delivery_status = 'PENDING' THEN 3
          ELSE 4
        END,
        d.delivery_id DESC
    `;
    const result = await pool.query(query, [riderId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching rider tasks:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงงานจัดส่งของไรเดอร์' });
  }
});

// ------------------------------------------------------------------------------
// 4. PUT /api/deliveries/:id/status
// คำอธิบาย: อัปเดตสถานะการจัดส่ง
// พารามิเตอร์:
//   - id: รหัสการจัดส่ง (delivery_id)
//   - status ใน Request Body: 'PENDING' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
// การทำงานเบื้องหลัง:
//   - หากสถานะเป็น 'DELIVERED' (ส่งสำเร็จ) ระบบจะบันทึกเวลาปัจจุบัน CURRENT_TIMESTAMP 
//     ลงในฟิลด์ `delivered_at` อัตโนมัติ เพื่อใช้วัดประสิทธิภาพ (SLA) เวลาที่ใช้ในการส่งของ
// ------------------------------------------------------------------------------
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let query = `UPDATE deliveries SET delivery_status = $1`;
    const params = [status, id];

    if (status === 'DELIVERED') {
      // ถ้าส่งสำเร็จ บันทึก timestamp ปัจจุบัน
      query += `, delivered_at = CURRENT_TIMESTAMP WHERE delivery_id = $2 RETURNING *`;
    } else {
      query += ` WHERE delivery_id = $2 RETURNING *`;
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบรายการจัดส่งนี้' });
    }

    const deliveryRow = result.rows[0];

    // เมื่อไรเดอร์จัดส่งสำเร็จและได้รับเงินแล้ว (DELIVERED):
    // ให้อัปเดตข้อมูลหัวบิลในตาราง orders ทันที:
    // - payment_status = 'PAID' (เปลี่ยนจาก PENDING เป็นชำระเงินแล้ว)
    // - order_status = 'COMPLETED' (สถานะบิลเสร็จสมบูรณ์)
    // - amount_received = total_amount (ได้รับเงินครบตามยอดสุทธิ)
    // - order_time = CURRENT_TIMESTAMP (บันทึกเวลาที่ได้รับเงินจริง เพื่อให้รายงานรายวันนำไปนับยอดขายในวันที่ได้รับเงินจริง)
    if (status === 'DELIVERED') {
      const finalPaymentMethod = req.body.final_payment_method;
      let paymentMethodSql = '';
      const updateParams = [deliveryRow.order_id];

      if (finalPaymentMethod) {
        paymentMethodSql = ', payment_method = $2';
        updateParams.push(finalPaymentMethod);
      }

      await pool.query(`
        UPDATE orders 
        SET payment_status = 'PAID',
            order_status = 'COMPLETED',
            amount_received = total_amount,
            order_time = CURRENT_TIMESTAMP
            ${paymentMethodSql}
        WHERE order_id = $1
      `, updateParams);
    } else if (status === 'CANCELLED') {
      await pool.query(`
        UPDATE orders 
        SET payment_status = 'CANCELLED',
            order_status = 'CANCELLED'
        WHERE order_id = $1
      `, [deliveryRow.order_id]);
    }

    res.status(200).json({ 
      message: 'อัปเดตสถานะการจัดส่งสำเร็จ',
      delivery: deliveryRow
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
  }
});

// ------------------------------------------------------------------------------
// 5. PUT /api/deliveries/:id/assign
// คำอธิบาย: ผู้จัดการหรือแคชเชียร์เลือกเปลี่ยน/มอบหมายไรเดอร์ให้ออเดอร์จัดส่ง
// พารามิเตอร์:
//   - id: รหัสการจัดส่ง (delivery_id)
//   - rider_id ใน Request Body: รหัสพนักงาน (employee_id) หรือ null หากต้องการยกเลิกการมอบหมาย
// ------------------------------------------------------------------------------
router.put('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { rider_id } = req.body;

    const result = await pool.query(
      `UPDATE deliveries SET rider_id = $1 WHERE delivery_id = $2 RETURNING *`,
      [rider_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบรายการจัดส่งนี้' });
    }

    res.status(200).json({ 
      message: 'มอบหมายพนักงานส่งสินค้าสำเร็จ',
      delivery: result.rows[0]
    });
  } catch (error) {
    console.error('Error assigning rider:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการมอบหมายไรเดอร์' });
  }
});

module.exports = router;

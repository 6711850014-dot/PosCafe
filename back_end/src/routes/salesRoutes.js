// ==============================================================================
// ไฟล์: back_end/src/routes/salesRoutes.js
// ระบบ: การขายและชำระเงิน (Sales Checkout & Stock Deduction)
// หน้าที่:
//   1. รับข้อมูลจากตะกร้าสินค้าหน้าร้าน (POS) มาบันทึกเป็นบิลขาย (orders)
//   2. รองรับประเภทออเดอร์ Dine-in / Takeaway / Delivery พร้อมบันทึกค่าจัดส่งและข้อมูลลูกค้า
//   3. ตัดสต็อกวัตถุดิบอัตโนมัติตามสูตรชง (Recipe) ด้วยหลักการ FIFO (First-In, First-Out)
//   4. ใช้ Database Transaction (BEGIN / COMMIT / ROLLBACK) เพื่อป้องกันข้อมูลผิดพลาด
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// POST /api/sales
// คำอธิบาย: ทำการบันทึกการขาย (Checkout) และตัดสต็อกวัตถุดิบ
// Request Body ที่ส่งเข้ามา:
//   - cart: รายการสินค้าในตะกร้า [{ product_id, product_name, qty, price }]
//   - total_amount: ยอดเงินรวมสุทธิของบิล (รวมค่าจัดส่งถ้ามี)
//   - employee_id: รหัสแคชเชียร์ผู้ทำรายการ
//   - payment_method: วิธีชำระเงิน ('เงินสด', 'โอนเงิน', ฯลฯ)
//   - amount_received: จำนวนเงินที่รับมาจากลูกค้า
//   - change_amount: เงินทอน
//   - order_type: ประเภทออเดอร์ ('dine_in', 'takeaway', 'delivery')
//   - delivery_fee: ค่าจัดส่ง
//   - delivery_info: { customer_name, customer_phone, delivery_address, rider_id, notes }
// ------------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { 
    cart, 
    total_amount, 
    employee_id, 
    payment_method, 
    amount_received, 
    change_amount,
    order_type,
    delivery_fee,
    delivery_info
  } = req.body; 

  try {
    // --------------------------------------------------------------------------
    // จุดสำคัญ: เริ่มต้น Database Transaction ด้วยคำสั่ง BEGIN
    // หากมีข้อผิดพลาดระหว่างทาง (เช่น วัตถุดิบหมดกลางคัน) ระบบจะสั่ง ROLLBACK 
    // เพื่อยกเลิกทุกคำสั่งย้อนหลังทั้งหมด บิลจะไม่ถูกบันทึก และสต็อกจะไม่แหว่ง
    // --------------------------------------------------------------------------
    await pool.query('BEGIN');

    // ตรวจสอบเงื่อนไขการชำระเงินของ Delivery:
    // หากเป็น Delivery และเลือก "เก็บเงินปลายทาง":
    // - payment_status จะเป็น 'PENDING' (รอชำระเงินปลายทาง)
    // - order_status จะเป็น 'PENDING_DELIVERY' (รอไรเดอร์ไปส่งและเก็บเงิน)
    // - amount_received และ change_amount จะเป็น 0 (เพราะยังไม่ได้รับเงินที่หน้าร้าน)
    // - ยอดขายนี้จะยังไม่ถูกนำไปนับในรายงานยอดขาย จนกว่าไรเดอร์จะกดยืนยันว่าส่งสำเร็จและได้รับเงินแล้ว
    const isCodDelivery = (order_type === 'delivery' && payment_method === 'เก็บเงินปลายทาง');
    const initialPaymentStatus = isCodDelivery ? 'PENDING' : 'PAID';
    const initialOrderStatus = (order_type === 'delivery') ? 'PENDING_DELIVERY' : 'COMPLETED';
    const finalAmountReceived = isCodDelivery ? 0 : (amount_received || total_amount);
    const finalChangeAmount = isCodDelivery ? 0 : (change_amount || 0);

    // 1. บันทึกข้อมูลหัวบิลลงตาราง orders พร้อมสถานะการชำระเงิน
    const orderResult = await pool.query(
      `INSERT INTO orders (
        total_amount, 
        employee_id, 
        payment_method, 
        amount_received, 
        change_amount, 
        order_type, 
        delivery_fee,
        payment_status,
        order_status
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING order_id, order_time, payment_status, order_status`,
      [
        total_amount, 
        employee_id || null, 
        payment_method, 
        finalAmountReceived, 
        finalChangeAmount,
        order_type || 'takeaway',
        delivery_fee || 0,
        initialPaymentStatus,
        initialOrderStatus
      ] 
    );
    const newOrderId = orderResult.rows[0].order_id;
    
    // 2. ถ้าเป็นออเดอร์ประเภท Delivery (จัดส่ง) ให้บันทึกข้อมูลจัดส่งลงตาราง deliveries
    if (order_type === 'delivery' && delivery_info) {
      await pool.query(
        `INSERT INTO deliveries (
          order_id, 
          customer_name, 
          customer_phone, 
          delivery_address, 
          delivery_fee, 
          rider_id, 
          notes, 
          delivery_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [
          newOrderId,
          delivery_info.customer_name || 'ลูกค้าเดลิเวอรี่',
          delivery_info.customer_phone || '',
          delivery_info.delivery_address || '',
          delivery_fee || 0,
          delivery_info.rider_id || null,
          delivery_info.notes || null
        ]
      );
    }

    // เวลาสำหรับพิมพ์ลงในใบเสร็จ
    const orderDate = new Date().toISOString();

    // 3. วนลูปบันทึกแต่ละรายการสินค้า (order_items) และตัดสต็อกวัตถุดิบ
    for (let item of cart) {
      // 3.1 บันทึกรายการสินค้าของบิล
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [newOrderId, item.product_id, item.qty, item.price]
      );

      // 3.2 ค้นหาว่าเมนูนี้มีสูตรชง (product_recipe) ต้องใช้วัตถุดิบอะไรบ้าง
      const recipeRes = await pool.query(
        'SELECT ingredient_id, quantity FROM product_recipe WHERE product_id = $1', 
        [item.product_id]
      );

      // 3.3 ตัดสต็อกวัตถุดิบแต่ละชนิดตามสูตร
      for (let recipe of recipeRes.rows) {
        // คำนวณปริมาณที่ต้องใช้ทั้งหมด = (สูตรต่อ 1 หน่วย) * (จำนวนแก้วที่ลูกค้าสั่ง)
        let amountNeeded = recipe.quantity * item.qty; 

        // 3.4 ดึงล็อตวัตถุดิบในตาราง inventory ด้วยหลักการ FIFO (First-In, First-Out):
        // - ล็อตที่หมดอายุก่อน หรือซื้อเข้ามาก่อน จะถูกดึงออกมาตัดก่อน
        // - ไม่เอาล็อตที่จำนวนคงเหลือเป็น 0 หรือหมดอายุไปแล้ว
        const lotsRes = await pool.query(
          `SELECT inventory_id, quantity FROM inventory 
           WHERE ingredient_id = $1 AND quantity > 0 AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
           ORDER BY expiration_date ASC NULLS LAST, purchase_date ASC`,
          [recipe.ingredient_id]
        );

        // 3.5 ตัดสต็อกทีละล็อตจนกว่าจะครบตามที่ต้องการ (amountNeeded = 0)
        for (let lot of lotsRes.rows) {
          if (amountNeeded <= 0) break; 

          if (lot.quantity >= amountNeeded) {
            // ล็อตนี้มีพอสำหรับยอดที่เหลือ: หักออกตามจำนวนที่ต้องการ
            await pool.query(
              'UPDATE inventory SET quantity = quantity - $1 WHERE inventory_id = $2', 
              [amountNeeded, lot.inventory_id]
            );
            amountNeeded = 0; 
          } else {
            // ล็อตนี้มีไม่พอ: ใช้จนหมดล็อต (เซ็ตเป็น 0) แล้วนำยอดที่เหลือไปตัดล็อตถัดไป
            await pool.query(
              'UPDATE inventory SET quantity = 0 WHERE inventory_id = $1', 
              [lot.inventory_id]
            );
            amountNeeded -= lot.quantity; 
          }
        }

        // หากวนทุกล็อตแล้ววัตถุดิบยังไม่พอ ให้โยน Error เพื่อยกเลิกบิล
        if (amountNeeded > 0) {
          throw new Error(`วัตถุดิบไม่พอชง "${item.product_name}"`);
        }
      }
    }

    // 4. บันทึกข้อมูลทั้งหมดเสร็จสมบูรณ์ ยืนยันการเปลี่ยนแปลงลงฐานข้อมูลด้วย COMMIT
    await pool.query('COMMIT');

    // ส่ง Order ID และเวลาบันทึกกลับไปให้หน้าบ้านทำใบเสร็จ
    res.status(201).json({ 
      message: isCodDelivery ? 'บันทึกคำสั่งซื้อจัดส่งสำเร็จ (รอชำระเงินปลายทาง)' : 'ชำระเงินสำเร็จ!', 
      order_id: newOrderId,
      created_at: orderDate,
      payment_status: initialPaymentStatus,
      order_status: initialOrderStatus
    });

  } catch (error) {
    // หากเกิดข้อผิดพลาดใดๆ ให้ยกเลิกคำสั่งทั้งหมดใน transaction ทันที
    await pool.query('ROLLBACK'); 
    console.error('Checkout Error:', error);

    if (error.message.includes('วัตถุดิบไม่พอชง')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกออเดอร์' });
  }
});

module.exports = router;

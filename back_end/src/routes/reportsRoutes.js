// ==============================================================================
// ไฟล์: back_end/src/routes/reportsRoutes.js
// ระบบ: รายงานยอดขายและวิเคราะห์ข้อมูลเชิงลึก (Sales Performance & Business Analytics API)
// หน้าที่:
//   1. สรุปภาพรวมยอดขาย (Gross Sales, Total Orders, Average Order Value - AOV)
//   2. วิเคราะห์มิติต่างๆ: สินค้าขายดี, หมวดหมู่, วิธีชำระเงิน, ช่วงเวลาพีค (Peak Hours), พนักงานขาย
//   3. การวิเคราะห์ข้อมูลขั้นสูง (Advanced Data Analysis):
//      - Market Basket Analysis (การวิเคราะห์ความสัมพันธ์ของคู่สินค้าที่มักถูกซื้อพร้อมกัน)
//      - ABC Analysis (Pareto Principle 80/20 แบ่งเกรดสินค้าตามสัดส่วนรายได้สะสม)
//   4. ส่งออกข้อมูลดิบเป็น CSV พร้อม UTF-8 BOM สำหรับนำไปเปิดใน Excel / Power BI / Python
// ==============================================================================

const express = require('express');
const router = express.Router();
const pool = require('../../db');

// ------------------------------------------------------------------------------
// Helper Function: สร้างเงื่อนไข WHERE สำหรับกรองช่วงเวลา (Date Filter)
// รองรับ: 'today' (วันนี้), '7days' (7 วันล่าสุด), '30days' (30 วันล่าสุด), 
//        'custom' (ระบุวันเริ่มต้น-สิ้นสุดเอง), หรือ 'all' (ทั้งหมด)
// ------------------------------------------------------------------------------
function buildDateCondition(range, startDate, endDate, paramStartIndex = 1) {
  const params = [];
  let condition = '';
  let idx = paramStartIndex;

  if (range === 'today') {
    condition = `WHERE order_time >= CURRENT_DATE`;
  } else if (range === '7days') {
    condition = `WHERE order_time >= CURRENT_DATE - INTERVAL '7 days'`;
  } else if (range === '30days') {
    condition = `WHERE order_time >= CURRENT_DATE - INTERVAL '30 days'`;
  } else if (range === 'custom' && startDate && endDate) {
    condition = `WHERE order_time >= $${idx}::date AND order_time < ($${idx + 1}::date + INTERVAL '1 day')`;
    params.push(startDate, endDate);
    idx += 2;
  } else {
    condition = '';
  }

  return { condition, params, nextIdx: idx };
}

// ------------------------------------------------------------------------------
// 1. GET /api/reports/summary
// คำอธิบาย: รวบรวมตัวเลขสรุปและกราฟวิเคราะห์ยอดขายทั้งหมดตามช่วงเวลาที่เลือก
// ประกอบด้วย 7 มิติสำคัญ:
//   1.1 KPIs: ยอดขายรวม (Gross Sales), จำนวนบิล (Orders), ยอดต่อบิลเฉลี่ย (AOV), บิลสูงสุด/ต่ำสุด
//   1.2 Payment Methods: สัดส่วนการชำระเงิน (เงินสด vs เงินโอน) และ % ส่วนแบ่ง
//   1.3 Top Products: 10 อันดับสินค้าที่ทำรายได้สูงสุด
//   1.4 Sales by Category: สัดส่วนรายได้แยกตามหมวดหมู่สินค้า
//   1.5 Hourly Trends: ยอดขายแยกตามชั่วโมง (Peak Hours) เพื่อใช้วางแผนจัดตารางเวรพนักงาน
//   1.6 Employee Sales: ยอดขายที่แคชเชียร์แต่ละคนทำได้
//   1.7 Daily Trends: แนวโน้มยอดขายรายวัน 30 วันล่าสุด
// ------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  try {
    const { range = 'all', startDate, endDate } = req.query;
    const { condition, params } = buildDateCondition(range, startDate, endDate);

    // 1.1 คำนวณ KPIs ภาพรวม
    const kpiQuery = `
      SELECT 
        COUNT(order_id) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS gross_sales,
        COALESCE(ROUND(AVG(total_amount), 2), 0) AS average_order_value,
        COALESCE(MAX(total_amount), 0) AS max_order_amount,
        COALESCE(MIN(total_amount), 0) AS min_order_amount
      FROM orders
      ${condition}
    `;
    const kpiRes = await pool.query(kpiQuery, params);

    // 1.2 สัดส่วนการชำระเงิน
    const paymentQuery = `
      SELECT 
        COALESCE(payment_method, 'ไม่ระบุ') AS payment_method,
        COUNT(order_id) AS order_count,
        COALESCE(SUM(total_amount), 0) AS total_amount,
        ROUND((SUM(total_amount)::numeric / NULLIF((SELECT SUM(total_amount) FROM orders ${condition}), 0) * 100), 1) AS percentage
      FROM orders
      ${condition}
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `;
    const paymentRes = await pool.query(paymentQuery, params);

    // 1.3 สินค้าขายดี 10 อันดับแรก
    let orderItemJoin = '';
    let oiCondition = '';
    if (condition) {
      orderItemJoin = 'JOIN orders o ON oi.order_id = o.order_id';
      oiCondition = condition.replace(/order_time/g, 'o.order_time');
    }

    const topProductsQuery = `
      SELECT 
        p.product_id,
        p.product_name,
        COALESCE(c.category_name, 'ทั่วไป') AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.quantity * oi.price) AS total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${orderItemJoin}
      ${oiCondition}
      GROUP BY p.product_id, p.product_name, c.category_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const topProductsRes = await pool.query(topProductsQuery, params);

    // 1.4 ยอดขายแยกตามหมวดหมู่
    const categoryQuery = `
      SELECT 
        COALESCE(c.category_name, 'อื่นๆ') AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.quantity * oi.price) AS total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${orderItemJoin}
      ${oiCondition}
      GROUP BY c.category_name
      ORDER BY total_revenue DESC
    `;
    const categoryRes = await pool.query(categoryQuery, params);

    // 1.5 ยอดขายรายชั่วโมง (Hourly Trends / Peak Hours Analysis)
    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM order_time)::int AS hour,
        COUNT(order_id) AS order_count,
        COALESCE(SUM(total_amount), 0) AS total_sales
      FROM orders
      ${condition}
      GROUP BY hour
      ORDER BY hour ASC
    `;
    const hourlyRes = await pool.query(hourlyQuery, params);

    // 1.6 ยอดขายแยกตามพนักงาน (Cashier Performance)
    const employeeQuery = `
      SELECT 
        COALESCE(e.employee_id, 'N/A') AS employee_id,
        COALESCE(e.first_name || ' ' || e.last_name, 'ไม่ระบุ') AS employee_name,
        COUNT(o.order_id) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_sales
      FROM orders o
      LEFT JOIN employee e ON o.employee_id = e.employee_id
      ${condition}
      GROUP BY e.employee_id, e.first_name, e.last_name
      ORDER BY total_sales DESC
    `;
    const employeeRes = await pool.query(employeeQuery, params);

    // 1.7 แนวโน้มยอดขายรายวัน (Daily Time Series)
    const dailyQuery = `
      SELECT 
        TO_CHAR(order_time, 'YYYY-MM-DD') AS sale_date,
        COUNT(order_id) AS order_count,
        COALESCE(SUM(total_amount), 0) AS total_sales
      FROM orders
      ${condition}
      GROUP BY sale_date
      ORDER BY sale_date ASC
      LIMIT 30
    `;
    const dailyRes = await pool.query(dailyQuery, params);

    res.status(200).json({
      kpis: {
        totalOrders: parseInt(kpiRes.rows[0]?.total_orders || 0),
        grossSales: parseFloat(kpiRes.rows[0]?.gross_sales || 0),
        aov: parseFloat(kpiRes.rows[0]?.average_order_value || 0),
        maxOrderAmount: parseFloat(kpiRes.rows[0]?.max_order_amount || 0),
        minOrderAmount: parseFloat(kpiRes.rows[0]?.min_order_amount || 0)
      },
      paymentMethods: paymentRes.rows,
      topProducts: topProductsRes.rows,
      categories: categoryRes.rows,
      hourlyTrends: hourlyRes.rows,
      employeeSales: employeeRes.rows,
      dailyTrends: dailyRes.rows
    });

  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการขาย' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/reports/analytics
// คำอธิบาย: การวิเคราะห์ข้อมูลเชิงลึกสำหรับธุรกิจ (Advanced Business Analytics)
// 2.1 Market Basket Analysis:
//     - ใช้ Self-Join ตาราง `order_items` กับตัวเอง โดยมีเงื่อนไข oi1.order_id = oi2.order_id 
//       และ oi1.product_id < oi2.product_id (เพื่อไม่ให้จับคู่กับตัวเอง และป้องกันคู่ซ้ำสลับด้าน)
//     - ประโยชน์: ใช้จัดเซ็ตโปรโมชั่นจับคู่ หรือทำ Cross-selling / Up-selling
// 2.2 ABC Classification (Pareto Principle 80/20):
//     - ใช้ SQL Window Function: SUM(...) OVER (ORDER BY ... DESC) คำนวณยอดสะสม (Running Total)
//     - Grade A: สินค้าที่มียอดขายสะสมแรกเริ่มถึง 80% (สินค้าหัวใจหลักของร้าน)
//     - Grade B: สินค้ายอดสะสมระหว่าง 80% - 95% (สินค้ารอง)
//     - Grade C: สินค้ายอดสะสม 5% สุดท้าย (สินค้าขายช้า อาจพิจารณาตัดสต็อกหรือจัดโปรระบาย)
// ------------------------------------------------------------------------------
router.get('/analytics', async (req, res) => {
  try {
    // 2.1 Market Basket Analysis
    const basketQuery = `
      SELECT 
        p1.product_name AS product_a,
        p2.product_name AS product_b,
        COUNT(DISTINCT oi1.order_id) AS pair_count
      FROM order_items oi1
      JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
      JOIN products p1 ON oi1.product_id = p1.product_id
      JOIN products p2 ON oi2.product_id = p2.product_id
      GROUP BY p1.product_name, p2.product_name
      ORDER BY pair_count DESC
      LIMIT 8
    `;
    const basketRes = await pool.query(basketQuery);

    // 2.2 ABC Classification Analysis
    const abcQuery = `
      WITH product_sales AS (
        SELECT 
          p.product_id,
          p.product_name,
          COALESCE(c.category_name, 'ทั่วไป') AS category_name,
          SUM(oi.quantity * oi.price) AS total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        GROUP BY p.product_id, p.product_name, c.category_name
      ),
      ranked_sales AS (
        SELECT 
          product_id,
          product_name,
          category_name,
          total_revenue,
          -- คำนวณยอดรวมสะสม (Running Total)
          SUM(total_revenue) OVER (ORDER BY total_revenue DESC) AS running_total,
          -- คำนวณยอดรวมทั้งหมดของร้าน (Grand Total)
          SUM(total_revenue) OVER () AS grand_total
        FROM product_sales
      )
      SELECT 
        product_id,
        product_name,
        category_name,
        total_revenue,
        ROUND((running_total / NULLIF(grand_total, 0) * 100), 2) AS cumulative_pct,
        CASE 
          WHEN (running_total / NULLIF(grand_total, 0)) <= 0.80 THEN 'A (สินค้าสร้างยอดหลัก 80%)'
          WHEN (running_total / NULLIF(grand_total, 0)) <= 0.95 THEN 'B (สินค้ายอดรอง 15%)'
          ELSE 'C (สินค้าเคลื่อนไหวช้า 5%)'
        END AS abc_grade
      FROM ranked_sales
      ORDER BY total_revenue DESC;
    `;
    const abcRes = await pool.query(abcQuery);

    res.status(200).json({
      marketBasket: basketRes.rows,
      abcAnalysis: abcRes.rows
    });
  } catch (error) {
    console.error('Error in analytics:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคำนวณ Data Analysis' });
  }
});

// ------------------------------------------------------------------------------
// 3. GET /api/reports/export
// คำอธิบาย: ส่งออกข้อมูลยอดขายระดับรายบรรทัด (Granular Item-Level Transaction CSV)
// จุดเด่นสำคัญ:
//   - แนบตัวอักษร Byte Order Mark (UTF-8 BOM `\uFEFF`) นำหน้าไฟล์ เพื่อให้โปรแกรม Microsoft Excel
//     บน Windows สามารถเปิดไฟล์ที่มีภาษาไทยได้โดยไม่เกิดปัญหาตัวอักษรต่างดาว (Font Garbling)
//   - Escape เครื่องหมายคำพูดคู่ (Double Quotes) ในชื่อสินค้าและชื่อแคชเชียร์ตามมาตรฐาน RFC 4180
// ------------------------------------------------------------------------------
router.get('/export', async (req, res) => {
  try {
    const { range = 'all', startDate, endDate } = req.query;
    const { condition, params } = buildDateCondition(range, startDate, endDate);

    let whereSql = '';
    if (condition) {
      whereSql = condition.replace(/order_time/g, 'o.order_time');
    }

    const query = `
      SELECT 
        o.order_id,
        TO_CHAR(o.order_time, 'YYYY-MM-DD') AS order_date,
        TO_CHAR(o.order_time, 'HH24:MI:SS') AS order_time,
        EXTRACT(HOUR FROM o.order_time) AS hour_of_day,
        TO_CHAR(o.order_time, 'Dy') AS day_of_week,
        COALESCE(o.employee_id, 'N/A') AS employee_id,
        COALESCE(e.first_name || ' ' || e.last_name, 'N/A') AS cashier_name,
        COALESCE(o.payment_method, 'เงินสด') AS payment_method,
        oi.product_id,
        p.product_name,
        COALESCE(c.category_name, 'ทั่วไป') AS category_name,
        oi.quantity,
        oi.price AS unit_price,
        (oi.quantity * oi.price) AS total_item_amount,
        o.total_amount AS order_total_amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN employee e ON o.employee_id = e.employee_id
      ${whereSql}
      ORDER BY o.order_id DESC, oi.item_id ASC
    `;

    const result = await pool.query(query, params);

    // ใส่ UTF-8 BOM \uFEFF ป้องกันภาษาไทยเพี้ยนใน Excel
    let csv = '\uFEFF';
    csv += 'Order ID,Date,Time,Hour,Day of Week,Cashier ID,Cashier Name,Payment Method,Product ID,Product Name,Category,Quantity,Unit Price,Item Total Amount,Order Total Amount\n';

    result.rows.forEach(row => {
      const escapedProductName = `"${(row.product_name || '').replace(/"/g, '""')}"`;
      const escapedCategoryName = `"${(row.category_name || '').replace(/"/g, '""')}"`;
      const escapedCashierName = `"${(row.cashier_name || '').replace(/"/g, '""')}"`;

      csv += [
        row.order_id,
        row.order_date,
        row.order_time,
        row.hour_of_day,
        row.day_of_week,
        row.employee_id,
        escapedCashierName,
        row.payment_method,
        row.product_id,
        escapedProductName,
        escapedCategoryName,
        row.quantity,
        row.unit_price,
        row.total_item_amount,
        row.order_total_amount
      ].join(',') + '\n';
    });

    const filename = `POS_Sales_Analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล' });
  }
});

// ------------------------------------------------------------------------------
// 5. GET /api/reports/today-items
// คำอธิบาย: สรุปรายการสินค้าที่ขายออกไปในวันนี้ (หรือวันที่เลือก)
// เพื่อให้ผู้บริหาร/เจ้าของร้านตรวจสอบได้ทันทีว่า "วันนี้ขายอะไรไปบ้าง แต่ละเมนูกี่แก้ว ยอดเท่าไร"
// ------------------------------------------------------------------------------
router.get('/today-items', async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD (ถ้าไม่ส่งมาจะใช้ CURRENT_DATE อัตโนมัติ)
    let whereClause = 'WHERE DATE(o.order_time) = CURRENT_DATE';
    const params = [];

    if (date) {
      whereClause = 'WHERE DATE(o.order_time) = $1::date';
      params.push(date);
    }

    const query = `
      SELECT 
        p.product_id,
        p.product_name,
        COALESCE(c.category_name, 'ทั่วไป') AS category_name,
        SUM(oi.quantity)::int AS total_qty,
        SUM(oi.quantity * oi.price)::numeric(12,2) AS total_revenue,
        ROUND(AVG(oi.price), 2) AS avg_unit_price,
        COUNT(DISTINCT oi.order_id)::int AS order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${whereClause}
      GROUP BY p.product_id, p.product_name, c.category_name
      ORDER BY total_qty DESC, total_revenue DESC
    `;

    const result = await pool.query(query, params);

    // คำนวณสรุปยอดรวมของสินค้าที่ขายออกไป
    const totalQtySold = result.rows.reduce((sum, item) => sum + parseInt(item.total_qty || 0), 0);
    const totalSalesAmount = result.rows.reduce((sum, item) => sum + parseFloat(item.total_revenue || 0), 0);
    const uniqueItemsCount = result.rows.length;

    res.status(200).json({
      targetDate: date || new Date().toISOString().slice(0, 10),
      summary: {
        totalQtySold,
        totalSalesAmount,
        uniqueItemsCount
      },
      items: result.rows
    });
  } catch (error) {
    console.error('Error fetching today items:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายงานสินค้าที่ขายได้วันนี้' });
  }
});

// ------------------------------------------------------------------------------
// 6. GET /api/reports/orders
// คำอธิบาย: ดึงประวัติรายการคำสั่งซื้อ (Orders History) พร้อมรายละเอียดครบถ้วน
// - วัน-เวลาที่ขายออกอย่างละเอียด (Formatted Date & Time)
// - แคชเชียร์ผู้ทำรายการ
// - วิธีชำระเงิน, เงินที่รับ, เงินทอน, ประเภทออเดอร์ (Dine-in / Takeaway / Delivery)
// - รายการสินค้าในแต่ละบิล (Embedded items array) สำหรับเปิดดูรายการสั่งซื้อในแต่ละบิล
// ------------------------------------------------------------------------------
router.get('/orders', async (req, res) => {
  try {
    const { range = 'today', startDate, endDate, search, limit = 100 } = req.query;
    const { condition: rawCondition, params, nextIdx } = buildDateCondition(range, startDate, endDate, 1);
    
    let whereClause = rawCondition ? rawCondition.replace(/order_time/g, 'o.order_time') : '';
    let currentIdx = nextIdx;

    if (search && search.trim() !== '') {
      const searchParam = `%${search.trim()}%`;
      const searchCond = `(
        o.order_id::text ILIKE ${currentIdx} OR 
        (e.first_name || ' ' || e.last_name) ILIKE ${currentIdx} OR 
        o.payment_method ILIKE ${currentIdx} OR
        d.customer_name ILIKE ${currentIdx}
      )`;
      whereClause = whereClause ? `${whereClause} AND ${searchCond}` : `WHERE ${searchCond}`;
      params.push(searchParam);
      currentIdx++;
    }

    const query = `
      SELECT 
        o.order_id,
        o.order_time,
        TO_CHAR(o.order_time, 'YYYY-MM-DD HH24:MI:SS') AS formatted_order_time,
        TO_CHAR(o.order_time, 'DD/MM/YYYY') AS sale_date_th,
        TO_CHAR(o.order_time, 'HH24:MI:SS') AS sale_time_th,
        o.total_amount,
        o.amount_received,
        o.change_amount,
        o.order_type,
        o.payment_method,
        o.delivery_fee,
        o.employee_id,
        COALESCE(e.first_name || ' ' || e.last_name, 'ไม่ระบุ') AS cashier_name,
        d.customer_name,
        d.customer_phone,
        d.delivery_address,
        d.delivery_status,
        d.notes AS delivery_notes,
        COALESCE(r.first_name || ' ' || r.last_name, '-') AS rider_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'product_id', oi.product_id,
              'product_name', p.product_name,
              'category_name', COALESCE(c.category_name, 'ทั่วไป'),
              'quantity', oi.quantity,
              'price', oi.price,
              'subtotal', (oi.quantity * oi.price)
            ))
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE oi.order_id = o.order_id
          ),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN employee e ON o.employee_id = e.employee_id
      LEFT JOIN deliveries d ON o.order_id = d.order_id
      LEFT JOIN employee r ON d.rider_id = r.employee_id
      ${whereClause}
      ORDER BY o.order_time DESC
      LIMIT ${currentIdx}
    `;
    params.push(parseInt(limit) || 100);

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching orders report:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายการคำสั่งซื้อ' });
  }
});

// ------------------------------------------------------------------------------
// 7. GET /api/reports/orders/:id
// คำอธิบาย: ดึงรายละเอียดบิลคำสั่งซื้อเดี่ยวแบบเจาะจง (Single Order Receipt / Detail)
// ------------------------------------------------------------------------------
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        o.order_id,
        o.order_time,
        TO_CHAR(o.order_time, 'YYYY-MM-DD HH24:MI:SS') AS formatted_order_time,
        TO_CHAR(o.order_time, 'DD/MM/YYYY') AS sale_date_th,
        TO_CHAR(o.order_time, 'HH24:MI:SS') AS sale_time_th,
        o.total_amount,
        o.amount_received,
        o.change_amount,
        o.order_type,
        o.payment_method,
        o.delivery_fee,
        o.employee_id,
        COALESCE(e.first_name || ' ' || e.last_name, 'ไม่ระบุ') AS cashier_name,
        d.customer_name,
        d.customer_phone,
        d.delivery_address,
        d.delivery_status,
        d.notes AS delivery_notes,
        COALESCE(r.first_name || ' ' || r.last_name, '-') AS rider_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'product_id', oi.product_id,
              'product_name', p.product_name,
              'category_name', COALESCE(c.category_name, 'ทั่วไป'),
              'quantity', oi.quantity,
              'price', oi.price,
              'subtotal', (oi.quantity * oi.price)
            ))
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE oi.order_id = o.order_id
          ),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN employee e ON o.employee_id = e.employee_id
      LEFT JOIN deliveries d ON o.order_id = d.order_id
      LEFT JOIN employee r ON d.rider_id = r.employee_id
      WHERE o.order_id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบบิลคำสั่งซื้อนี้' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order by id:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบิล' });
  }
});

module.exports = router;


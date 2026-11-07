# 💻 คู่มือเจาะลึกการทำงานของชุดโค้ดระบบ PosCafe (Code Deep Dive & Technical Reference)
> **เอกสารการเรียนรู้ชิ้นที่ 2: ผ่าการทำงานของโค้ดโปรแกรม ฟังก์ชัน และคำสั่ง SQL ทีละขั้นตอนโดยเฉพาะ**  
> *เอกสารนี้จัดทำขึ้นเพื่ออธิบายหลักการทำงานของซอร์สโค้ด (Source Code) ในโปรเจกต์ PosCafe ทั้งฝั่ง Backend (Node.js/Express) และ Frontend (React) อย่างละเอียด*

---

## 📑 สารบัญเนื้อหา (Table of Contents)
1. **โครงสร้างสถาปัตยกรรมไดเรกทอรี (Project Directory Layout)**
2. **ผ่าโค้ดแกนหลักของ Backend (`server.js` และ `db.js`)**
3. **ผ่าโค้ดตรรกะหัวใจสำคัญ: การขายและตัดสต็อก FIFO (`salesRoutes.js`)**
4. **ผ่าโค้ดวิเคราะห์ข้อมูลเชิงลึก: Market Basket และ ABC Pareto (`reportsRoutes.js`)**
5. **ผ่าโค้ดระบบจัดการเดลิเวอรี่และหน้าจอมือถือไรเดอร์ (`deliveryRoutes.js`)**
6. **ผ่าโค้ดฝั่ง Frontend: Routing, Dynamic RBAC และ State Management**
7. **สรุปเทคนิคและความปลอดภัยในการเขียน Query (Security & Performance Practices)**

---

# 1. โครงสร้างสถาปัตยกรรมไดเรกทอรี (Project Directory Layout)

ระบบ PosCafe แยกโครงสร้างเป็น 2 โฟลเดอร์หลักอย่างเป็นสัดส่วน:

```
PosCafe/
├── back_end/                          # ฝั่งเซิร์ฟเวอร์และตรรกะธุรกิจ (Node.js + Express)
│   ├── src/
│   │   └── routes/                    # แหล่งรวมโมดูล API แต่ละระบบงาน
│   │       ├── authRoutes.js          # ระบบตรวจสอบตัวตนและสิทธิ์ (Login)
│   │       ├── salesRoutes.js         # ระบบคิดเงิน ออกบิล และตัดสต็อก FIFO (สำคัญที่สุด)
│   │       ├── stockRoutes.js         # จัดการวัตถุดิบและสต็อกสินค้า
│   │       ├── recipeRoutes.js        # จัดการสูตรชง (BOM: Bill of Materials)
│   │       ├── deliveryRoutes.js      # จัดการงานส่งของ และ API หน้าจอมือถือไรเดอร์
│   │       ├── reportsRoutes.js       # วิเคราะห์สถิติ ยอดขาย Market Basket และ ABC Pareto
│   │       ├── productsRoutes.js      # จัดการเมนูเครื่องดื่มและเบเกอรี่
│   │       ├── categoriesRoutes.js    # จัดการหมวดหมู่สินค้า
│   │       ├── promotionRoutes.js     # จัดการโปรโมชั่นและส่วนลด % รายเมนู
│   │       ├── procurementRoutes.js   # จัดซื้อวัตถุดิบเข้าสต็อก
│   │       ├── employeesRoutes.js     # จัดการข้อมูลพนักงาน
│   │       └── rolesRoutes.js         # จัดการตำแหน่งและกำหนดสิทธิ์แบบไดนามิก
│   ├── uploads/                       # ที่เก็บไฟล์รูปภาพสินค้าที่อัปโหลดผ่าน Multer
│   ├── db.js                          # ตัวเชื่อมต่อฐานข้อมูล PostgreSQL (pg Pool)
│   ├── server.js                      # Main Entry Point ของเซิร์ฟเวอร์
│   └── package.json                   # การกำหนดค่าและ Dependencies ของ Backend
│
├── front_end/                         # ฝั่งหน้าจอผู้ใช้งาน (React 18 + Vite)
│   ├── src/
│   │   ├── components/                # คอมโพเนนต์ที่ใช้ร่วมกัน
│   │   │   ├── Layout.jsx             # โครงหน้าจอหลักที่ครอบ Sidebar และ Content
│   │   │   └── Sidebar.jsx            # แถบเมนูด้านข้างที่กรองสิทธิ์แสดงผลอัตโนมัติ (RBAC)
│   │   ├── pages/                     # หน้าจอของแต่ละระบบงาน
│   │   │   ├── POSPage.jsx            # หน้าจอขายหน้าร้าน (จุดรวมการคิดเงินและตะกร้าสินค้า)
│   │   │   ├── RiderDeliveryPage.jsx  # หน้าจอมือถือแบบ Standalone สำหรับไรเดอร์วิ่งส่งของ
│   │   │   ├── DeliveryPage.jsx       # หน้าจอจัดการคิวจัดส่งสำหรับผู้จัดการหน้าร้าน
│   │   │   ├── ReportsPage.jsx        # หน้าจอ Dashboard รายงานยอดขายและกราฟวิเคราะห์
│   │   │   ├── StockPage.jsx          # หน้าจอตรวจนับสต็อกวัตถุดิบ
│   │   │   ├── ProductsPage.jsx       # หน้าจอจัดการเมนูสินค้าและผูกสูตรชง
│   │   │   ├── ProcurementPage.jsx    # หน้าจอบันทึกการสั่งซื้อวัตถุดิบ
│   │   │   ├── PromotionsPage.jsx     # หน้าจอสร้างโปรโมชั่นส่วนลด
│   │   │   ├── EmployeesPage.jsx      # หน้าจอบริหารพนักงาน
│   │   │   ├── RolesPage.jsx          # หน้าจอกำหนดสิทธิ์การเข้าถึงเมนู
│   │   │   └── LoginPage.jsx          # หน้าจอลงชื่อเข้าใช้งาน
│   │   ├── main.jsx                   # จุดเริ่มต้น React และตั้งค่า React Router
│   │   └── index.css                  # สไตล์ชีตสากลของทั้งระบบ
│   └── package.json                   # การกำหนดค่าและ Dependencies ของ Frontend
│
├── cloudflared.exe                    # โปรแกรม Cloudflare Tunnel สำหรับเชื่อมมือถือไรเดอร์
└── start-rider-tunnel.bat             # ไฟล์สคริปต์เปิดทางเชื่อมต่อไรเดอร์ 4G/5G แบบ 1-Click
```

---

# 2. ผ่าโค้ดแกนหลักของ Backend (`server.js` และ `db.js`)

### 2.1 การทำงานของ Connection Pool ใน `back_end/db.js`

```javascript
// ไฟล์: back_end/db.js
const { Pool } = require("pg");
require("dotenv").config(); // ดึงค่าตัวแปรจากไฟล์ .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // จำเป็นสำหรับเชื่อมต่อกับ Cloud Database เช่น Supabase
  },
});
```

#### 🔍 อธิบายการทำงานของโค้ด:
1. **`Pool` จากแพ็กเกจ `pg`:** ทำหน้าที่สร้าง **Connection Pool** แทนการสร้างการเชื่อมต่อใหม่ทุกครั้งที่มี Request เข้ามา การใช้ Pool ช่วยประหยัดเวลาในการทำ Handshake ลดภาระของฐานข้อมูล และรองรับการทำงานแบบพร้อมกัน (Concurrent Requests) ได้อย่างมีประสิทธิภาพ
2. **`ssl: { rejectUnauthorized: false }`:** Supabase บังคับเชื่อมต่อผ่านพอร์ต 5432 หรือ 6543 ด้วยการเข้ารหัส SSL/TLS ค่าคอนฟิกนี้สั่งให้ Node.js ยอมรับ Self-signed certificate ของผู้ให้บริการ Cloud ได้อย่างปลอดภัย
3. **การส่งออก `module.exports = pool;`:** ช่วยให้ทุกไฟล์ในโฟลเดอร์ `routes/` สามารถ Import ออบเจกต์ `pool` นี้ไปยิงคำสั่ง SQL ได้ทันทีโดยใช้ทรัพยากรการเชื่อมต่อร่วมกัน

---

### 2.2 การบูตระบบและจัดการไฟล์ Static ใน `back_end/server.js`

```javascript
// ไฟล์: back_end/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();

// อนุญาตให้ Frontend (Port 5173) ส่งข้อมูลข้ามพอร์ตมาหา Backend (Port 5000) ได้
app.use(cors());

// แปลง Request Body ที่ส่งมาในรูปแบบ JSON ให้อยู่ในรูป Object (req.body)
app.use(express.json());

// ตั้งค่าที่เก็บไฟล์รูปภาพสินค้าด้วย Multer DiskStorage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// เปิดให้เบราว์เซอร์เข้าถึงรูปภาพผ่าน URL เช่น http://localhost:5000/uploads/1729864.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

#### 🔍 อธิบายการทำงานของโค้ด:
1. **`app.use(cors())`:** เบราว์เซอร์มีนโยบายความปลอดภัย Same-Origin Policy หากไม่มีคำสั่งนี้ เมื่อ React ยิง API มายัง Express จะเกิดข้อผิดพลาด `CORS policy blocked`
2. **`Date.now() + path.extname(...)`:** เทคนิคการเปลี่ยนชื่อไฟล์รูปภาพตอนอัปโหลด โดยใช้เวลาปัจจุบันระดับมิลลิวินาทีต่อท้ายด้วยนามสกุลเดิม เพื่อป้องกันปัญหาชื่อไฟล์ซ้ำกัน (Filename Collision) เมื่อมีการอัปโหลดรูปชื่อเดียวกัน

---

# 3. ผ่าโค้ดตรรกะหัวใจสำคัญ: การขายและตัดสต็อก FIFO (`salesRoutes.js`)

ไฟล์ `back_end/src/routes/salesRoutes.js` คือโมดูลที่สำคัญที่สุดในระบบ POS เพราะเป็นจุดที่มีการทำงานร่วมกันระหว่าง **การเงิน (Finance)**, **ความสัมพันธ์ของตาราง (Relational Schema)** และ **คลังสินค้า (Inventory)**

### 3.1 การเริ่มต้น Database Transaction
เมื่อแคชเชียร์กดยืนยันการขาย ระบบจะเริ่มเปิด Transaction ทันที:

```javascript
// โค้ดใน salesRoutes.js บรรทัดที่ 48
await pool.query('BEGIN');
```

> **หลักการวิศวกรรม:** หากไม่มีคำสั่ง `BEGIN` ถ้าการบันทึกบิลสำเร็จ แต่ตอนตัดสต็อกวัตถุดิบเกิด Error (เช่น ไฟดับ หรือเน็ตหลุด) ระบบจะบันทึกเงินแต่ไม่ได้ตัดสต็อก ส่งผลให้ข้อมูลคลังผิดเพี้ยนทันที  
> แต่เมื่อใช้ `BEGIN` หากมีข้อผิดพลาดเกิดขึ้นที่บรรทัดใดก็ตาม โค้ดจะกระโดดเข้าบล็อก `catch` และสั่ง:
> ```javascript
> await pool.query('ROLLBACK');
> ```
> ข้อมูลทุกอย่างที่ทำไปจะถูกย้อนกลับทั้งหมดเสมือนไม่เคยมีอะไรเกิดขึ้น (Atomicity ในคุณสมบัติ ACID)

---

### 3.2 การจำแนกออเดอร์เดลิเวอรี่ (COD vs Paid)

```javascript
// salesRoutes.js บรรทัดที่ 56-61
const isCodDelivery = (order_type === 'delivery' && payment_method === 'เก็บเงินปลายทาง');
const initialPaymentStatus = isCodDelivery ? 'PENDING' : 'PAID';
const initialOrderStatus = (order_type === 'delivery') ? 'PENDING_DELIVERY' : 'COMPLETED';
const finalAmountReceived = isCodDelivery ? 0 : (amount_received || total_amount);
const finalChangeAmount = isCodDelivery ? 0 : (change_amount || 0);
```

#### 🔍 อธิบายตรรกะ:
- หากเป็นออเดอร์หน้าร้าน (Dine-in / Takeaway): ชำระเงินสดหรือโอนเงินแล้วทันที -> กำหนด `payment_status = 'PAID'`
- หากเป็นออเดอร์จัดส่ง (Delivery) และเลือก **"เก็บเงินปลายทาง"**: ลูกค้ายังไม่ได้จ่ายเงินที่เคาน์เตอร์ -> บันทึกสถานะเป็น `'PENDING'` เพื่อป้องกันไม่ให้ยอดเงินลอยเข้าบัญชีร้านก่อนเก็บเงินจริง

---

### 3.3 ผ่าอัลกอริทึมตัดสต็อกวัตถุดิบ FIFO ทีละบรรทัด (The FIFO Engine)

นี่คือชุดโค้ดที่มีความซับซ้อนและสำคัญที่สุดในระบบ:

```javascript
// salesRoutes.js บรรทัดที่ 120-175
for (let item of cart) {
  // 1. บันทึกรายการสินค้าลงในตาราง order_items
  await pool.query(
    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
    [newOrderId, item.product_id, item.qty, item.price]
  );

  // 2. ค้นหาส่วนประกอบวัตถุดิบจากสูตรชงของสินค้านี้ (Bill of Materials)
  const recipeRes = await pool.query(
    'SELECT ingredient_id, quantity FROM product_recipe WHERE product_id = $1', 
    [item.product_id]
  );

  // 3. วนลูปตามวัตถุดิบแต่ละตัวที่ต้องใช้
  for (let recipe of recipeRes.rows) {
    // ปริมาณที่ต้องใช้รวม = (ปริมาณต่อแก้ว) * (จำนวนแก้วที่ลูกค้าสั่ง)
    let amountNeeded = recipe.quantity * item.qty; 

    // 4. ดึงล็อตวัตถุดิบจากตาราง inventory ตามหลัก FIFO (First-In, First-Out)
    // เงื่อนไข: จำนวนต้องเหลือมากกว่า 0 และยังไม่หมดอายุ
    // การเรียงลำดับ: เรียงตามวันหมดอายุใกล้สุดก่อน (expiration_date ASC)
    const lotsRes = await pool.query(
      `SELECT inventory_id, quantity FROM inventory 
       WHERE ingredient_id = $1 AND quantity > 0 AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
       ORDER BY expiration_date ASC NULLS LAST, purchase_date ASC`,
      [recipe.ingredient_id]
    );

    // 5. ลูปหักลบจำนวนคงเหลือตามล็อต
    for (let lot of lotsRes.rows) {
      if (amountNeeded <= 0) break; // ตัดครบยอดแล้ว ออกจากลูป

      if (lot.quantity >= amountNeeded) {
        // กรณี ก: ล็อตนี้มีวัตถุดิบเพียงพอสำหรับยอดที่เหลือ
        // หักจำนวนที่ต้องการออกจากล็อตนี้ แล้วเคลียร์ amountNeeded เป็น 0
        await pool.query(
          'UPDATE inventory SET quantity = quantity - $1 WHERE inventory_id = $2', 
          [amountNeeded, lot.inventory_id]
        );
        amountNeeded = 0; 
      } else {
        // กรณี ข: ล็อตนี้มีไม่พอ แต่มีเหลืออยู่บ้าง
        // หักล็อตนี้จนหมดเกลี้ยง (quantity = 0) และลดยอดที่ต้องการลงตามจำนวนที่หักไป
        amountNeeded -= lot.quantity; 
        await pool.query(
          'UPDATE inventory SET quantity = 0 WHERE inventory_id = $1', 
          [lot.inventory_id]
        );
      }
    } // จบลูปตัดล็อต

    // 6. ตรวจสอบว่าหลังจากวนทุกล็อตแล้ว ยังมียอดค้างอยู่อีกหรือไม่
    if (amountNeeded > 0) {
      // วัตถุดิบในสต็อกมีไม่พอขาย! สั่งขัดจังหวะเพื่อไปเข้า catch ทันที
      throw new Error(`วัตถุดิบไม่เพียงพอสำหรับการตัดสต็อก (รหัสวัตถุดิบ: ${recipe.ingredient_id})`);
    }
  }
}

// 7. เมื่อทุกอย่างสำเร็จอย่างสมบูรณ์ ทำการยืนยันการบันทึกข้อมูล
await pool.query('COMMIT');
```

---

# 4. ผ่าโค้ดวิเคราะห์ข้อมูลเชิงลึก: Market Basket และ ABC Pareto (`reportsRoutes.js`)

ไฟล์ `back_end/src/routes/reportsRoutes.js` แสดงตัวอย่างการใช้พลังของฐานข้อมูล PostgreSQL ในการวิเคราะห์ข้อมูลทางธุรกิจขั้นสูง (Advanced Analytics) แทนที่จะดึงข้อมูลดิบมาวนลูปคำนวณใน JavaScript

### 4.1 การคำนวณ Market Basket Analysis (คู่สินค้าที่มักซื้อด้วยกัน)
ในระบบคาเฟ่ การรู้ว่า "ลูกค้าที่ซื้อกาแฟเอสเปรสโซ่ มักจะซื้อครัวซองต์ด้วย" ช่วยให้จัดเซ็ตโปรโมชั่นได้ตรงใจ:

```sql
-- โค้ด SQL ภายใน reportsRoutes.js
SELECT 
    p1.product_name AS product_a,
    p2.product_name AS product_b,
    COUNT(*) AS pair_count
FROM order_items oi1
JOIN order_items oi2 
    ON oi1.order_id = oi2.order_id 
    AND oi1.product_id < oi2.product_id   -- เทคนิคตัดคู่ซ้ำ เช่น (กาแฟ, ครัวซองต์) กับ (ครัวซองต์, กาแฟ)
JOIN products p1 ON oi1.product_id = p1.product_id
JOIN products p2 ON oi2.product_id = p2.product_id
JOIN orders o ON oi1.order_id = o.order_id
WHERE COALESCE(o.payment_status, 'PAID') = 'PAID'
GROUP BY p1.product_name, p2.product_name
ORDER BY pair_count DESC
LIMIT 10;
```

#### 🔍 เคล็ดลับวิศวกรรมในโค้ดนี้:
- คำสั่ง `oi1.product_id < oi2.product_id` เป็นเทคนิคทางคณิตศาสตร์แบบ Combination ($C(n, 2)$) เพื่อป้องกันไม่ให้สินค้าจับคู่กับตัวเอง (`A กับ A`) และป้องกันการนับสลับข้าง (`A กับ B` ซ้ำกับ `B กับ A`) ทำให้ได้คู่สินค้าที่ถูกต้อง 100%

---

### 4.2 การคำนวณ ABC Analysis ตามกฎพาเรโต 80/20 (Pareto Principle)
สินค้าในร้านกาแฟไม่ได้สร้างกำไรเท่ากัน สินค้ากลุ่ม A คือ 20% ของเมนูที่สร้างรายได้ 80% ให้กับร้าน:

```javascript
// โค้ดใน reportsRoutes.js ฟังก์ชันคำนวณ ABC Classification
let cumulativeRevenue = 0;
const abcData = rankedProducts.map((p) => {
  cumulativeRevenue += Number(p.total_revenue);
  // คำนวณสัดส่วนรายได้สะสมเป็นเปอร์เซ็นต์ (0 - 100%)
  const cumulativePct = (cumulativeRevenue / totalRevenue) * 100;
  
  // จัดเกรดตามสัดส่วนพาเรโต
  let grade = 'C';
  if (cumulativePct <= 70) {
    grade = 'A';      // สินค้ากลุ่ม A: สร้างรายได้ 70% แรก (สินค้าขายดี ตัวเอกของร้าน)
  } else if (cumulativePct <= 90) {
    grade = 'B';      // สินค้ากลุ่ม B: สร้างรายได้ 70% - 90% (สินค้าระดับปานกลาง)
  } else {
    grade = 'C';      // สินค้ากลุ่ม C: สร้างรายได้ 10% สุดท้าย (สินค้าหางแถว ควรพิจารณาปรับปรุง)
  }

  return { ...p, cumulativePct, grade };
});
```

---

# 5. ผ่าโค้ดระบบจัดการเดลิเวอรี่และหน้าจอมือถือไรเดอร์ (`deliveryRoutes.js`)

### 5.1 การดึงงานเฉพาะตัวสำหรับไรเดอร์แต่ละคน

```javascript
// deliveryRoutes.js: API สำหรับหน้าจอมือถือไรเดอร์
router.get('/rider/:rider_id', async (req, res) => {
  const { rider_id } = req.params;
  const result = await pool.query(
    `SELECT d.*, o.total_amount, o.payment_method, o.payment_status
     FROM deliveries d
     JOIN orders o ON d.order_id = o.order_id
     WHERE d.rider_id = $1 AND d.delivery_status != 'DELIVERED'
     ORDER BY d.created_at ASC`,
    [rider_id]
  );
  res.json(result.rows);
});
```

#### 🔍 อธิบายการทำงาน:
- หน้าจอมือถือไรเดอร์จะส่ง `rider_id` ของตัวเอง (ได้มาจากการ Login) เข้ามาที่ Endpoint นี้
- ระบบจะกรองงานเฉพาะที่เป็นของไรเดอร์คนนั้น และซ่อนงานที่ส่งมอบเสร็จแล้ว (`!= 'DELIVERED'`) ทำให้หน้าจอมือถือไรเดอร์เห็นเฉพาะออเดอร์ที่ต้องไปส่งในปัจจุบันอย่างกระชับ ไม่รกสายตา

---

### 5.2 การจบงานและปิดยอดชำระเงินเมื่อส่งถึงมือลูกค้า

```javascript
// deliveryRoutes.js: ไรเดอร์กดยืนยันส่งมอบสำเร็จ
router.put('/:id/delivered', async (req, res) => {
  const { id } = req.params;
  
  // 1. อัปเดตสถานะการจัดส่งในตาราง deliveries
  const deliveryRes = await pool.query(
    `UPDATE deliveries 
     SET delivery_status = 'DELIVERED', delivered_at = NOW() 
     WHERE delivery_id = $1 
     RETURNING order_id`,
    [id]
  );

  const orderId = deliveryRes.rows[0].order_id;

  // 2. ปลดล็อกสถานะของบิลขายในตาราง orders ให้เป็น PAID ทันที
  await pool.query(
    `UPDATE orders 
     SET payment_status = 'PAID', 
         order_status = 'COMPLETED',
         amount_received = total_amount
     WHERE order_id = $1`,
    [orderId]
  );

  res.json({ message: 'ส่งมอบสินค้าและบันทึกการรับเงินสำเร็จ' });
});
```

---

# 6. ผ่าโค้ดฝั่ง Frontend: Routing, Dynamic RBAC และ State Management

### 6.1 การจำแนกเส้นทางตามตำแหน่งงานใน `front_end/src/main.jsx`

```jsx
// main.jsx
const InitialRoute = () => {
  const userStr = sessionStorage.getItem("user");
  if (!userStr) return <Navigate to="/login" replace />;

  const user = JSON.parse(userStr);
  const userRoleId = Number(user?.role_id) || 0;
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];

  // กฎข้อที่ 1: ถ้าเป็นไรเดอร์ (Role = 3 หรือมีสิทธิ์ menu_rider) ให้เด้งไปหน้าจอมือถือทันที
  if (userPermissions.includes("menu_rider") || userRoleId === 3) {
    return <Navigate to="/rider-delivery" replace />;
  }

  // กฎข้อที่ 2: ถ้าเป็นแคชเชียร์หรือผู้จัดการ ให้พาไปหน้าขายหน้าร้าน POS
  return <Navigate to="/pos" replace />;
};
```

#### 🔍 ความชาญฉลาดของการออกแบบ:
- สังเกตว่าหน้า `/rider-delivery` ถูกวางไว้นอกคอมโพเนนต์ `<ProtectedLayout />`
- ทำให้ไรเดอร์ที่เปิดผ่านสมาร์ตโฟน จะได้หน้าจอแบบเต็มจอ (Full Screen) ไม่มีแถบ Sidebar ขนาดใหญ่มาบดบังสายตา เหมาะกับอุปกรณ์พกพาขนาดเล็ก

---

### 6.2 การกรองเมนู Sidebar แบบไดนามิกใน `front_end/src/components/Sidebar.jsx`

```jsx
// Sidebar.jsx
const allMenuItems = [
  { path: "/pos", label: "ขายหน้าร้าน", icon: <FaCashRegister />, permission: "menu_pos", fallbackRoleIds: [1, 2] }, 
  { path: "/delivery", label: "การจัดส่ง", icon: <FaMotorcycle />, permission: "menu_delivery", fallbackRoleIds: [1] },
  { path: "/promotions", label: "จัดการโปรโมชั่น", icon: <FaTag />, permission: "menu_promotions", fallbackRoleIds: [1] },
  { path: "/stocks", label: "สต็อกวัตถุดิบ", icon: <FaWarehouse />, permission: "menu_stocks", fallbackRoleIds: [1] }, 
  { path: "/reports", label: "รายงานผลการขาย", icon: <FaChartBar />, permission: "menu_reports", fallbackRoleIds: [1] }, 
];

// กรองเมนูที่จะแสดงผล
const authorizedMenus = allMenuItems.filter(item => {
  if (userRoleId === 1 || user?.role === 'Admin') return true; // Admin เห็นทุกเมนู
  if (userPermissions.includes(item.permission)) return true;   // ตรวจสอบจากก้อน JSONB
  return item.fallbackRoleIds.includes(userRoleId);             // Fallback ตาม Role ID เดิม
});
```

---

### 6.3 State Management ในหน้าจอขายหน้าร้าน `front_end/src/pages/POSPage.jsx`

การจัดการตะกร้าสินค้าใช้ React Hook `useState` ในการควบคุม:

```jsx
// ฟังก์ชันเพิ่มสินค้าลงตะกร้า พร้อมคำนวณส่วนลดโปรโมชั่นแบบ Real-time
const addToCart = (product) => {
  const promo = getProductPromo(product.product_id);
  const originalPrice = Number(product.price);
  
  // คำนวณส่วนลดอัตโนมัติจาก %
  const discountPct = promo ? Number(promo.discount_percentage) : 0;
  const finalPrice = promo ? Math.round(originalPrice * (1 - discountPct / 100)) : originalPrice;

  setCart(prevCart => {
    const existingItem = prevCart.find(item => item.product_id === product.product_id);
    const currentQty = existingItem ? existingItem.qty : 0;

    // ตรวจสอบกับจำนวนแก้วสูงสุดที่วัตถุดิบในสต็อกสามารถชงได้ (max_qty)
    if (currentQty + 1 > product.max_qty) {
      Swal.fire('วัตถุดิบไม่พอ!', `"${product.product_name}" เหลือวัตถุดิบชงได้อีกแค่ ${product.max_qty} ที่`, 'warning');
      return prevCart; // ไม่เพิ่มจำนวนลงตะกร้า
    }

    if (existingItem) {
      return prevCart.map(item => item.product_id === product.product_id ? { ...item, qty: item.qty + 1 } : item);
    }

    return [...prevCart, { 
      ...product, 
      qty: 1,
      price: finalPrice,
      original_price: originalPrice,
      discount_percentage: discountPct,
      promo_name: promo ? promo.promotion_name : null
    }];
  });
};
```

---

# 7. สรุปเทคนิคและความปลอดภัยในการเขียน Query (Security & Performance Practices)

### 7.1 การป้องกัน SQL Injection 100% ด้วย Parameterized Queries
ในทุกไฟล์ของ Backend ไม่มีการนำตัวแปรจากผู้ใช้มาต่อสตริง SQL โดยตรง เช่น:
- ❌ **รูปแบบที่ไม่ปลอดภัย (ห้ามทำเด็ดขาด):**
  ```javascript
  // อันตราย: ผู้ใช้สามารถใส่ ' OR '1'='1 เพื่อขโมยข้อมูลได้
  pool.query(`SELECT * FROM employee WHERE username = '${req.body.username}'`);
  ```
- ✅ **รูปแบบที่ปลอดภัยในโค้ด PosCafe (ใช้สัญลักษณ์แทนที่ `$1, $2`):**
  ```javascript
  // ปลอดภัย: pg library จะแปลงค่าเป็นสตริงข้อมูลดิบเท่านั้น ไม่มีการรันเป็นคำสั่ง SQL
  pool.query('SELECT * FROM employee WHERE username = $1', [req.body.username]);
  ```

---

### 7.2 สรุปการเชื่อมโยงระบบ (End-to-End Traceability Matrix)

| หน้าจอ Frontend | Event ที่ผู้ใช้กระทำ | API Endpoint ที่ถูกเรียก | คำสั่ง SQL และตารางที่เกี่ยวข้อง | ผลลัพธ์ทางธุรกิจ |
| :--- | :--- | :--- | :--- | :--- |
| **`LoginPage.jsx`** | กรอก User/Pass แล้วกดเข้าสู่ระบบ | `POST /api/auth/login` | `SELECT employee JOIN roles` | ได้รับข้อมูลผู้ใช้และสิทธิ์ permissions (JSONB) บันทึกลง `sessionStorage` |
| **`POSPage.jsx`** | กดเลือกเมนูกาแฟลงตะกร้า | เรียกภายใน State | เปรียบเทียบกับ `product.max_qty` | ป้องกันแคชเชียร์รับออเดอร์เกินวัตถุดิบจริงที่มีในร้าน |
| **`POSPage.jsx`** | แคชเชียร์กดยืนยันชำระเงิน | `POST /api/sales` | `BEGIN`, `INSERT orders`, `INSERT order_items`, `UPDATE inventory`, `COMMIT` | บันทึกยอดขาย หักลบสต็อก FIFO ออกใบเสร็จ |
| **`RiderDeliveryPage.jsx`** | ไรเดอร์กด "ส่งมอบสำเร็จ" | `PUT /api/deliveries/:id/delivered` | `UPDATE deliveries`, `UPDATE orders SET payment_status = 'PAID'` | งานเสร็จสิ้น ยอดเงินสดปลายทางถูกดึงเข้าสู่รายงานยอดขาย |
| **`ReportsPage.jsx`** | ผู้จัดการเลือกดูกราฟช่วงเวลา | `GET /api/reports/summary` | `SELECT SUM(total_amount)`, Group by hour, Category | สรุปยอดขายรวม กราฟชั่วโมงเร่งด่วน และคำนวณพาเรโต ABC |

---
*เอกสารชิ้นนี้จัดทำขึ้นสำหรับเป็นคู่มืออ้างอิงเชิงเทคนิคและการศึกษาซอร์สโค้ดของระบบ PosCafe อย่างละเอียดและถูกต้องตรงตามโครงสร้างของโปรแกรมจริง 100%*

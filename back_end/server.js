// ==============================================================================
// ไฟล์: back_end/server.js
// ระบบ: Express Server หลัก (Backend Main Entry Point)
// หน้าที่:
//   1. ตั้งค่า Express Application, CORS และ Middleware แปลง JSON Body
//   2. ตั้งค่า Multer สำหรับอัปโหลดและให้บริการรูปภาพสินค้าแบบ Static Files
//   3. ลงทะเบียน API Endpoints ทั้งหมดของระบบ POS:
//      - /api/auth          : เข้าสู่ระบบ และดึงสิทธิ์ (Permissions)
//      - /api/employees     : จัดการข้อมูลพนักงาน
//      - /api/roles         : จัดการตำแหน่งและกำหนดสิทธิ์แบบไดนามิก (RBAC)
//      - /api/products      : จัดการข้อมูลสินค้า
//      - /api/categories    : จัดการหมวดหมู่สินค้า
//      - /api/stock         : จัดการวัตถุดิบและสต็อกสินค้า
//      - /api/sales         : บันทึกการขาย (POS Checkout) และตัดสต็อก FIFO
//      - /api/recipes       : สูตรชงสินค้า (BOM)
//      - /api/reports       : รายงานยอดขายและ Data Analysis (Market Basket & ABC Pareto)
//      - /api/deliveries    : จัดการการส่งสินค้า และ API หน้าจอมือถือไรเดอร์
//      - /api/promotions    : จัดการโปรโมชั่นส่วนลด % รายเมนู
//      - /api/procurements  : การจัดซื้อวัตถุดิบเข้าสต็อก (Simple Receiving)
// ==============================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();

// อนุญาตให้ Frontend ส่งข้อมูลข้ามโดเมน/พอร์ตได้ (Cross-Origin Resource Sharing)
app.use(cors());

// แปลง Request Body ที่เป็น JSON ให้กลายเป็น JavaScript Object (req.body) อัตโนมัติ
app.use(express.json());

// ------------------------------------------------------------------------------
// การตั้งค่า Multer สำหรับอัปโหลดรูปภาพสินค้า
// ------------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // บันทึกไฟล์ลงในโฟลเดอร์ uploads/
  },
  filename: function (req, file, cb) {
    // ตั้งชื่อไฟล์ใหม่ด้วย Timestamp เพื่อป้องกันชื่อไฟล์ซ้ำกัน
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// เปิดให้เข้าถึงโฟลเดอร์ uploads ผ่าน URL แบบ Static Files เช่น /uploads/xxx.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API รับไฟล์รูปภาพสินค้า
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ไม่มีไฟล์ถูกอัปโหลด' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl: imageUrl });
});

// ------------------------------------------------------------------------------
// นำเข้าโมดูล Routes ทั้งหมดของระบบ
// ------------------------------------------------------------------------------
const authRoutes = require('./src/routes/authRoutes');
const employeesRoutes = require('./src/routes/employeesRoutes');
const rolesRoutes = require('./src/routes/rolesRoutes');
const productsRoutes = require('./src/routes/productsRoutes');
const categoriesRoutes = require('./src/routes/categoriesRoutes');
const stockRoutes = require('./src/routes/stockRoutes');
const salesRoutes = require('./src/routes/salesRoutes');
const recipeRoutes = require('./src/routes/recipeRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const deliveryRoutes = require('./src/routes/deliveryRoutes');
const promotionRoutes = require('./src/routes/promotionRoutes');
const procurementRoutes = require('./src/routes/procurementRoutes');

// ------------------------------------------------------------------------------
// ลงทะเบียน API Endpoints (Prefix /api)
// ------------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/procurements', procurementRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('✅ POS Backend is Running smoothly!');
});

// ------------------------------------------------------------------------------
// เริ่มต้นการทำงานของ Server
// ------------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

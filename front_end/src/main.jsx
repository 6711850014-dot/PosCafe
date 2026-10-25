import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import Layout from "./components/Layout";
import SalesPage from "./pages/SalesPage";
import EmployeesPage from "./pages/EmployeesPage";
import ProductsPage from "./pages/ProductsPage";
import ReportsPage from "./pages/ReportsPage";
import StockPage from "./pages/StockPage";
import LoginPage from "./pages/LoginPage";
import RolesPage from './pages/RolesPage';
import POSPage from './pages/POSPage';
import DeliveryPage from './pages/DeliveryPage';
import PromotionsPage from './pages/PromotionsPage';
import ProcurementPage from './pages/ProcurementPage';
import RiderDeliveryPage from './pages/RiderDeliveryPage';

// ------------------------------------------------------------------
// 1. สร้าง Component สำหรับคำนวณและพาไปยัง "หน้าแรก" ตามสิทธิ์
// ------------------------------------------------------------------
const InitialRoute = () => {
  const userStr = sessionStorage.getItem("user");
  
  // ถ้ายังไม่ล็อกอิน ให้กลับไปหน้า login
  if (!userStr) return <Navigate to="/login" replace />;

  const user = JSON.parse(userStr);
  const userRoleId = Number(user?.role_id) || 0;
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];

  // สิทธิ์ที่ 1: ถ้าเป็นไรเดอร์ (Role = 3) หรือมีสิทธิ์ menu_rider ให้เด้งไปหน้ามือถือ (Standalone)
  if (userPermissions.includes("menu_rider") || userRoleId === 3) {
    return <Navigate to="/rider-delivery" replace />;
  }

  // สิทธิ์ที่ 2: ถ้าเป็น Admin (1), Cashier (2) หรือมีสิทธิ์ menu_pos ให้เด้งไปหน้า POS
  if (userPermissions.includes("menu_pos") || userRoleId === 1 || userRoleId === 2) {
    return <Navigate to="/pos" replace />;
  }

  // ค่าเริ่มต้นสำหรับสิทธิ์อื่นๆ ให้ไปหน้า POS หรือปรับเป็นหน้าที่ต้องการได้
  return <Navigate to="/pos" replace />;
};

// ------------------------------------------------------------------
// 2. สร้าง Component ป้องกัน Layout (ตรวจสอบแบบ Dynamic)
// ------------------------------------------------------------------
const ProtectedLayout = () => {
  const isLoggedIn = sessionStorage.getItem("user");
  return isLoggedIn ? <Layout /> : <Navigate to="/login" replace />;
};

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* 1. หน้า Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* 2. หน้าจอเฉพาะสำหรับไรเดอร์บนมือถือ (ไม่มี Sidebar บัง) */}
      <Route path="/rider-delivery" element={<RiderDeliveryPage />} />

      {/* 3. โครงสร้างที่มี Sidebar (ProtectedLayout) */}
      <Route path="/" element={<ProtectedLayout />}>
        {/* สำคัญมาก: Route index คือเมื่อเข้า URL "/" ให้ไปคำนวณหน้าแรกที่ InitialRoute */}
        <Route index element={<InitialRoute />} />
        
        <Route path="pos" element={<POSPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="procurement" element={<ProcurementPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="stocks" element={<StockPage />} />
      </Route>

      {/* 4. กรณีพิมพ์ URL ผิด (404) ให้พากลับเข้ากระบวนการกรองหน้าแรก */}
      <Route path="*" element={<InitialRoute />} />
    </Routes>
  </BrowserRouter>
);
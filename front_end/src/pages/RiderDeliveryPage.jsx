// ==============================================================================
// ไฟล์: front_end/src/pages/RiderDeliveryPage.jsx
// ระบบ: หน้าจอมือถือสำหรับไรเดอร์ (Mobile-First Rider Interface)
// วัตถุประสงค์:
//   - ออกแบบสำหรับแสดงผลบนหน้าจอสมาร์ตโฟนโดยเฉพาะ (Responsive Mobile UI)
//   - ทำงานได้ทั้งบน Wi-Fi ภายในร้าน และเชื่อมต่อผ่านเน็ตมือถือ 4G/5G จากภายนอก
//   - มีปุ่มลัดแตะโทรออกหาลูกค้าทันที (One-Touch Phone Call)
//   - มีปุ่มลัดเปิดแอป Google Maps นำทางไปยังที่อยู่ลูกค้าโดยตรง
//   - มีระบบแจ้งเตือนชัดเจนกรณีเก็บเงินปลายทาง (COD Warning)
//   - อัปเดตสถานะ "เริ่มเดินทาง" และ "ส่งสำเร็จ" พร้อมบันทึกเวลาส่งมอบจริง
// ==============================================================================

import React, { useState, useEffect } from 'react';
import './RiderDeliveryPage.css';
import { 
  FaMotorcycle, 
  FaPhoneAlt, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaClock, 
  FaMoneyBillWave, 
  FaReceipt, 
  FaUser, 
  FaSyncAlt, 
  FaBoxOpen, 
  FaArrowLeft 
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

// ------------------------------------------------------------------------------
// การกำหนด API Base URL แบบยืดหยุ่น:
// - หากเปิดผ่าน Cloudflare Tunnel (*.trycloudflare.com) หรือผ่าน Vite Port 5173 
//   จะใช้ค่าว่าง ('') เพื่อให้เบราว์เซอร์เรียกใช้ Vite Reverse Proxy ส่งต่อไปยังพอร์ต 5000 
//   ซึ่งแก้ปัญหาเรื่อง CORS และไม่ต้องเปิดพอร์ต 5000 ออกสู่สาธารณะ
// - หากเปิดตรงๆ ผ่าน IP เครื่อง ให้ชี้ไปยังพอร์ต 5000 ของเครื่องนั้น
// ------------------------------------------------------------------------------
const API_BASE = window.location.hostname.includes('trycloudflare.com') || 
                 window.location.hostname.includes('loca.lt') || 
                 window.location.hostname.includes('ngrok') ||
                 window.location.port === '5173'
  ? '' 
  : `http://${window.location.hostname || 'localhost'}:5000`;

export default function RiderDeliveryPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - riders: รายชื่อไรเดอร์ทั้งหมดสำหรับสลับดูงาน
  // - selectedRiderId: รหัสไรเดอร์ที่เลือกอยู่ในปัจจุบัน
  // - tasks: รายการงานส่งของของไรเดอร์คนนั้น
  // - loading: แสดงสถานะการโหลดงาน
  // ----------------------------------------------------------------------------
  const [riders, setRiders] = useState([]);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // ดึงรายชื่อไรเดอร์ทันทีที่เปิดหน้าเว็บ
  useEffect(() => {
    fetchRiders();
  }, []);

  // เมื่อเลือกไรเดอร์คนใด ให้ดึงงานเฉพาะของไรเดอร์คนนั้น
  useEffect(() => {
    if (selectedRiderId) {
      fetchRiderTasks(selectedRiderId);
    }
  }, [selectedRiderId]);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายชื่อไรเดอร์ และตรวจจับว่าผู้ใช้ที่กำลังล็อกอินอยู่เป็นใคร
  // ----------------------------------------------------------------------------
  const fetchRiders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/deliveries/riders`);
      if (response.ok) {
        const data = await response.json();
        setRiders(data);

        // ตรวจสอบข้อมูลผู้ใช้ใน sessionStorage หากผู้ใช้ล็อกอินอยู่ ให้เลือกชื่อให้อัตโนมัติ
        const loggedInUserStr = sessionStorage.getItem('user');
        if (loggedInUserStr) {
          const userObj = JSON.parse(loggedInUserStr);
          const found = data.find(r => r.employee_id === userObj.employee_id);
          if (found) {
            setSelectedRiderId(found.employee_id);
            return;
          }
        }

        // หากไม่ได้ล็อกอิน หรือไม่มีชื่อ ให้เลือกไรเดอร์คนแรกเป็นค่าเริ่มต้น
        if (data.length > 0) {
          setSelectedRiderId(data[0].employee_id);
        }
      }
    } catch (error) {
      console.error('Error fetching riders:', error);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายการงานส่งของของไรเดอร์คนนั้น
  // ----------------------------------------------------------------------------
  const fetchRiderTasks = async (riderId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/deliveries/my-tasks/${riderId}`);
      if (response.ok) {
        setTasks(await response.json());
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ไรเดอร์กด "เริ่มออกส่งสินค้า" (เปลี่ยนสถานะเป็น OUT_FOR_DELIVERY)
  // ----------------------------------------------------------------------------
  const handleStartDelivery = async (deliveryId) => {
    try {
      const response = await fetch(`${API_BASE}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' })
      });
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'เริ่มออกเดินทาง!',
          text: 'ขับขี่ปลอดภัยนะครับ 🛵',
          timer: 1500,
          showConfirmButton: false
        });
        fetchRiderTasks(selectedRiderId); // รีเฟรชรายการงาน
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ไรเดอร์กดยืนยัน "ส่งของสำเร็จและจบงาน" (เปลี่ยนสถานะเป็น DELIVERED)
  // - มี Modal ยืนยัน พร้อมเตือนจำนวนเงินสดที่ต้องเก็บจากลูกค้า (COD)
  // ----------------------------------------------------------------------------
  const handleCompleteDelivery = (task) => {
    const isCash = task.payment_method === 'เงินสด';
    Swal.fire({
      title: 'ยืนยันการส่งสินค้า?',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>ลูกค้า:</strong> ${task.customer_name}</p>
          <p><strong>ยอดเงินที่ต้องเก็บ:</strong> <span style="color: ${isCash ? '#e74c3c' : '#27ae60'}; font-weight: bold;">
            ${isCash ? `฿${Number(task.total_amount).toLocaleString()} (เงินสด COD)` : 'ชำระเงินแล้ว'}
          </span></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: '✅ ส่งสำเร็จแล้ว',
      cancelButtonText: 'ยังไม่เสร็จ'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE}/api/deliveries/${task.delivery_id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'DELIVERED' })
          });
          if (response.ok) {
            Swal.fire({
              icon: 'success',
              title: 'บันทึกส่งสำเร็จ!',
              text: isCash ? 'อย่าลืมนำเงินสดกลับมาเคลียร์ที่ร้านนะครับ' : 'ส่งของเรียบร้อย',
              timer: 2000,
              showConfirmButton: false
            });
            fetchRiderTasks(selectedRiderId); // รีเฟรชรายการงาน
          }
        } catch (error) {
          Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกสำเร็จได้', 'error');
        }
      }
    });
  };

  // แยกงานที่ยังทำไม่เสร็จ (active) กับงานที่ส่งสำเร็จแล้ว (finished)
  const activeTasks = tasks.filter(t => t.delivery_status !== 'DELIVERED' && t.delivery_status !== 'CANCELLED');
  const finishedTasks = tasks.filter(t => t.delivery_status === 'DELIVERED');

  return (
    <div className="rider-mobile-container">
      {/* ส่วนหัว Mobile App Bar ด้านบน */}
      <div className="rider-top-bar">
        <div className="top-bar-left">
          <Link to="/pos" className="btn-back-pos" title="กลับไปหน้า POS">
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="app-title"><FaMotorcycle /> POS Rider</h1>
            <p className="app-subtitle">ระบบจัดส่งสำหรับคนขับ</p>
          </div>
        </div>

        {/* ปุ่มกดรีเฟรชงานใหม่ */}
        <button className="btn-rider-refresh" onClick={() => fetchRiderTasks(selectedRiderId)} title="รีเฟรชงาน">
          <FaSyncAlt />
        </button>
      </div>

      {/* แถบเลือกคนขับ (สะดวกเมื่อเปิดผ่านมือถือหลายๆ เครื่อง) */}
      <div className="rider-selector-card">
        <label><FaUser /> คนขับปัจจุบัน:</label>
        <select 
          value={selectedRiderId} 
          onChange={(e) => setSelectedRiderId(e.target.value)}
          className="rider-dropdown"
        >
          {riders.map(r => (
            <option key={r.employee_id} value={r.employee_id}>
              {r.first_name} {r.last_name} ({r.employee_id})
            </option>
          ))}
        </select>
      </div>

      {/* กล่องสรุปจำนวนงาน (Dashboard Stats) */}
      <div className="rider-stats-grid">
        <div className="stat-card stat-pending">
          <span className="stat-num">{activeTasks.length}</span>
          <span className="stat-text">งานที่ต้องส่ง</span>
        </div>
        <div className="stat-card stat-done">
          <span className="stat-num">{finishedTasks.length}</span>
          <span className="stat-text">ส่งสำเร็จแล้ว</span>
        </div>
      </div>

      {/* รายการออเดอร์ที่ต้องจัดส่ง (Active Tasks) */}
      <div className="rider-tasks-section">
        <h2 className="section-title">
          <FaBoxOpen /> รายการออเดอร์จัดส่ง ({activeTasks.length} รายการ)
        </h2>

        {loading ? (
          <div className="rider-loading">กำลังโหลดงานจัดส่ง...</div>
        ) : activeTasks.length === 0 ? (
          <div className="rider-empty-tasks">
            <FaCheckCircle className="empty-icon" />
            <h3>ไม่มีงานจัดส่งค้างอยู่</h3>
            <p>ออเดอร์ทั้งหมดถูกจัดส่งเรียบร้อยแล้ว หรือยังไม่มีออเดอร์ใหม่</p>
          </div>
        ) : (
          activeTasks.map((task) => {
            const isCash = task.payment_method === 'เงินสด';
            const items = task.items || [];

            return (
              <div key={task.delivery_id} className={`rider-task-card status-${task.delivery_status.toLowerCase()}`}>
                {/* หัวการ์ด: รหัสจัดส่ง และสถานะ */}
                <div className="task-card-header">
                  <div>
                    <span className="task-id-badge">#DEL-{task.delivery_id}</span>
                    <span className="task-order-ref">บิล #{task.order_id}</span>
                  </div>
                  <span className={`task-status-pill pill-${task.delivery_status.toLowerCase()}`}>
                    {task.delivery_status === 'OUT_FOR_DELIVERY' ? '🛵 กำลังไปส่ง' : '⏳ รอเตรียมของ'}
                  </span>
                </div>

                {/* ข้อมูลลูกค้า และที่อยู่จัดส่ง */}
                <div className="task-customer-box">
                  <h3 className="customer-name">{task.customer_name}</h3>
                  <div className="customer-address">
                    <FaMapMarkerAlt className="icon-map" />
                    <span>{task.delivery_address}</span>
                  </div>
                  {task.notes && (
                    <div className="customer-notes">
                      <strong>หมายเหตุ:</strong> {task.notes}
                    </div>
                  )}
                </div>

                {/* ปุ่มแตะด่วนสำหรับมือถือ: แตะโทรหาลูกค้า และ แตะเปิด Google Maps */}
                <div className="rider-quick-actions">
                  {/* tel: protocol จะเรียกเปิดหน้าโทรศัพท์ของสมาร์ตโฟนทันที */}
                  <a href={`tel:${task.customer_phone}`} className="btn-action btn-call">
                    <FaPhoneAlt /> โทรหาลูกค้า ({task.customer_phone})
                  </a>
                  {/* Google Maps Search URL API พร้อม encodeURIComponent รองรับภาษาไทย */}
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.delivery_address)}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-action btn-map"
                  >
                    <FaMapMarkerAlt /> เปิดแผนที่นำทาง (Google Maps)
                  </a>
                </div>

                {/* รายการสินค้าในออเดอร์ */}
                <div className="task-items-list">
                  <span className="items-title">รายการอาหาร/เครื่องดื่ม:</span>
                  {items.map((it, idx) => (
                    <div key={idx} className="item-row">
                      <span>• {it.quantity}x {it.product_name}</span>
                      <span>฿{(it.price * it.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="item-row delivery-fee-row">
                    <span>• ค่าจัดส่ง</span>
                    <span>฿{Number(task.delivery_fee).toLocaleString()}</span>
                  </div>
                </div>

                {/* แถบแจ้งเตือนการชำระเงิน (COD vs ชำระแล้ว) */}
                <div className={`payment-notice ${isCash ? 'notice-cod' : 'notice-paid'}`}>
                  <div className="payment-notice-left">
                    <FaMoneyBillWave />
                    <div>
                      <span className="notice-title">
                        {isCash ? 'เก็บเงินสดปลายทาง (COD)' : 'ชำระเงินเรียบร้อยแล้ว'}
                      </span>
                      <span className="notice-sub">
                        {isCash ? 'ต้องเก็บเงินสดจากลูกค้า' : 'ไม่ต้องเก็บเงินเพิ่ม'}
                      </span>
                    </div>
                  </div>
                  <span className="notice-amount">
                    ฿{Number(task.total_amount).toLocaleString()}
                  </span>
                </div>

                {/* ปุ่มกดเปลี่ยนสถานะงานตามลำดับขั้นตอน */}
                <div className="task-footer-actions">
                  {task.delivery_status !== 'OUT_FOR_DELIVERY' ? (
                    <button 
                      className="btn-main-action btn-start-shipping"
                      onClick={() => handleStartDelivery(task.delivery_id)}
                    >
                      <FaMotorcycle /> เริ่มออกเดินทาง (กำลังไปส่ง)
                    </button>
                  ) : (
                    <button 
                      className="btn-main-action btn-finish-shipping"
                      onClick={() => handleCompleteDelivery(task)}
                    >
                      <FaCheckCircle /> ยืนยันส่งสินค้าสำเร็จ
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ส่วนประวัติออเดอร์ที่ส่งสำเร็จแล้วของวัน */}
      {finishedTasks.length > 0 && (
        <div className="finished-tasks-section">
          <h3 className="section-title-sub">
            <FaCheckCircle style={{ color: '#10b981' }} /> รายการที่ส่งสำเร็จแล้ววันนี้ ({finishedTasks.length})
          </h3>
          <div className="finished-list">
            {finishedTasks.map(task => (
              <div key={task.delivery_id} className="finished-item">
                <div>
                  <strong>#DEL-{task.delivery_id} ({task.customer_name})</strong>
                  <p className="finished-address">{task.delivery_address}</p>
                </div>
                <span className="finished-amount">฿{Number(task.total_amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// ไฟล์: front_end/src/pages/RiderDeliveryPage.jsx
// ระบบ: หน้าจอมือถือสำหรับไรเดอร์ (Mobile-First Rider Interface)
// วัตถุประสงค์:
//   - ออกแบบสำหรับแสดงผลบนหน้าจอสมาร์ตโฟนโดยเฉพาะ (Responsive Mobile UI)
//   - ล็อกข้อมูลให้แสดงเฉพาะงานของไรเดอร์ที่ล็อกอินอยู่เท่านั้น (ไม่มีสิทธิ์ดูงานคนอื่น)
//   - มีปุ่มลัดแตะโทรออกหาลูกค้าทันที และเปิด Google Maps นำทาง
//   - มีระบบแจ้งเตือนชัดเจนกรณีเก็บเงินปลายทาง (COD Warning)
//   - เพิ่มปุ่ม "กลับหน้า POS" เฉพาะสำหรับ Admin เท่านั้น
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './RiderDeliveryPage.css';
import { 
  FaMotorcycle, 
  FaPhoneAlt, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaMoneyBillWave, 
  FaUser, 
  FaSyncAlt, 
  FaBoxOpen, 
  FaSignOutAlt,
  FaArrowLeft // นำเข้าไอคอนลูกศรย้อนกลับ
} from 'react-icons/fa';
import Swal from 'sweetalert2';

// ------------------------------------------------------------------------------
// การกำหนด API Base URL แบบยืดหยุ่น
// ------------------------------------------------------------------------------
const API_BASE = window.location.hostname.includes('trycloudflare.com') || 
                 window.location.hostname.includes('loca.lt') || 
                 window.location.hostname.includes('ngrok') ||
                 window.location.port === '5173'
  ? '' 
  : `http://${window.location.hostname || 'localhost'}:5000`;

export default function RiderDeliveryPage() {
  const navigate = useNavigate();

  // ----------------------------------------------------------------------------
  // State Management:
  // ----------------------------------------------------------------------------
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [riderName, setRiderName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // State สำหรับเช็คว่าเป็น Admin หรือไม่
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // ทำงานครั้งแรกเมื่อเปิดหน้าจอ
  useEffect(() => {
    // 1. ดึงข้อมูลผู้ใช้จาก Session
    const loggedInUserStr = sessionStorage.getItem('user');
    if (loggedInUserStr) {
      const userObj = JSON.parse(loggedInUserStr);
      setSelectedRiderId(userObj.employee_id);
      
      // ตรวจสอบว่าเป็น Admin หรือไม่ (Role ID = 1 หรือ Role = Admin)
      const userRoleId = Number(userObj?.role_id) || 0;
      if (userRoleId === 1 || userObj?.role === 'Admin') {
        setIsAdmin(true);
      }

      // กำหนดชื่อสำหรับแสดงผลบนหน้าจอ
      const fullName = userObj.name || userObj.first_name || 'พนักงานจัดส่ง';
      setRiderName(fullName);

      // 2. โหลดงานของไรเดอร์คนนี้ทันที
      fetchRiderTasks(userObj.employee_id);
    } else {
      // ถ้าไม่มี session ให้เตะกลับไปหน้าล็อกอินแบบไม่ให้กดย้อนกลับ
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายการงานส่งของของไรเดอร์คนนั้น
  // ----------------------------------------------------------------------------
  const fetchRiderTasks = async (riderId) => {
    if (!riderId) return;
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
  // ฟังก์ชัน: ออกจากระบบ (Logout)
  // ----------------------------------------------------------------------------
  const handleLogout = () => {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ?',
      text: "คุณต้องการเลิกงานและออกจากระบบใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        navigate('/login', { replace: true }); 
      }
    });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ไรเดอร์กด "เริ่มออกส่งสินค้า"
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
          text: 'ขับขี่ปลอดภัยนะครับ',
          timer: 1500,
          showConfirmButton: false
        });
        fetchRiderTasks(selectedRiderId); 
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ไรเดอร์กดยืนยัน "ส่งของสำเร็จและจบงาน"
  // ----------------------------------------------------------------------------
  const handleCompleteDelivery = (task) => {
    const isCod = task.payment_method === 'เก็บเงินปลายทาง' || task.payment_method === 'เงินสด';

    if (isCod) {
      Swal.fire({
        title: ' ยืนยันการจัดส่ง & รับเงินปลายทาง',
        html: `
          <div style="text-align: left; font-size: 14px;">
            <p style="margin: 0 0 6px 0;"><strong>ลูกค้า:</strong> ${task.customer_name} (${task.customer_phone})</p>
            <p style="margin: 0 0 14px 0;"><strong>ยอดเงินที่ต้องเรียกเก็บ:</strong> <span style="color: #e11d48; font-size: 20px; font-weight: bold;">฿${Number(task.total_amount).toLocaleString()}</span></p>
            
            <label style="display: block; font-weight: bold; margin-bottom: 8px; color: #0f172a;">
               ไรเดอร์โปรดระบุ: ลูกค้าชำระเงินจริงด้วยวิธีใด?
            </label>
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
              <label style="flex: 1; border: 2px solid #0284c7; background: #f0f9ff; padding: 12px 8px; border-radius: 8px; cursor: pointer; text-align: center; font-weight: 700; color: #0369a1;">
                <input type="radio" name="rider_payment_method" value="เงินสด" checked style="margin-right: 6px; transform: scale(1.2);" />
                 ลูกค้าจ่าย เงินสด
              </label>
              <label style="flex: 1; border: 2px solid #10b981; background: #f0fdf4; padding: 12px 8px; border-radius: 8px; cursor: pointer; text-align: center; font-weight: 700; color: #047857;">
                <input type="radio" name="rider_payment_method" value="โอนเงิน" style="margin-right: 6px; transform: scale(1.2);" />
                 ลูกค้า สแกนโอน
              </label>
            </div>
            <p style="color: #64748b; font-size: 12px; margin: 0; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px dashed #cbd5e1;">
              * เมื่อกดยืนยัน ระบบจะบันทึกยอดเงินเข้าสู่ฐานข้อมูลหลัก และบันทึกเป็นยอดขายจริงของร้านทันที
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: ' ยืนยันรับเงินและปิดบิล',
        cancelButtonText: 'ยังไม่เสร็จ',
        preConfirm: () => {
          const selected = document.querySelector('input[name="rider_payment_method"]:checked');
          return selected ? selected.value : 'เงินสด';
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          const chosenMethod = result.value;
          try {
            const response = await fetch(`${API_BASE}/api/deliveries/${task.delivery_id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                status: 'DELIVERED',
                final_payment_method: chosenMethod
              })
            });
            if (response.ok) {
              Swal.fire({
                icon: 'success',
                title: 'ส่งสำเร็จและบันทึกยอดแล้ว!',
                html: `ลูกค้าชำระด้วย: <strong style="color: #0284c7;">${chosenMethod}</strong><br/>ระบบได้บันทึกยอดขาย <strong>฿${Number(task.total_amount).toLocaleString()}</strong> เข้าสู่ฐานข้อมูลหลักเรียบร้อยแล้ว`,
                timer: 2800,
                showConfirmButton: false
              });
              fetchRiderTasks(selectedRiderId);
            }
          } catch (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกสำเร็จได้', 'error');
          }
        }
      });
    } else {
      Swal.fire({
        title: 'ยืนยันการจัดส่งสำเร็จ?',
        html: `
          <div style="text-align: left; font-size: 14px;">
            <p><strong>ลูกค้า:</strong> ${task.customer_name}</p>
            <p><strong>สถานะการเงิน:</strong> <span style="color: #10b981; font-weight: bold;">ชำระเงินล่วงหน้าแล้ว (ไม่ต้องเก็บเงินเพิ่ม)</span></p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ส่งสำเร็จแล้ว',
        cancelButtonText: 'ยกเลิก'
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
                title: 'ส่งสินค้าเรียบร้อย!',
                timer: 1800,
                showConfirmButton: false
              });
              fetchRiderTasks(selectedRiderId);
            }
          } catch (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกสถานะได้', 'error');
          }
        }
      });
    }
  };

  const activeTasks = tasks.filter(t => t.delivery_status !== 'DELIVERED' && t.delivery_status !== 'CANCELLED');
  const finishedTasks = tasks.filter(t => t.delivery_status === 'DELIVERED');

  return (
    <div className="rider-mobile-container">
      {/* ส่วนหัว Mobile App Bar ด้านบน พร้อมปุ่ม Logout และปุ่มกลับ (เฉพาะ Admin) */}
      <div className="rider-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="top-bar-left">
          <div>
            <h1 className="app-title"><FaMotorcycle /> POS Rider</h1>
            <p className="app-subtitle">ระบบจัดส่งสำหรับคนขับ</p>
          </div>
        </div>

        {/* ปุ่มด้านขวา: นำทางและล็อกเอาต์ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          
          {/* แสดงปุ่ม "กลับหน้า POS" เฉพาะตอนที่ผู้ใช้เป็น Admin */}
          {isAdmin && (
            <button 
              onClick={() => navigate('/pos')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="กลับไปที่หน้า POS หลัก"
            >
              <FaArrowLeft /> หน้า POS
            </button>
          )}

          <button className="btn-rider-refresh" onClick={() => fetchRiderTasks(selectedRiderId)} title="รีเฟรชงาน">
            <FaSyncAlt />
          </button>
          
          <button 
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '22px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="ออกจากระบบ"
          >
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* แถบแสดงโปรไฟล์คนขับปัจจุบัน */}
      <div style={{ 
        padding: '12px 20px', 
        backgroundColor: 'white', 
        margin: '15px', 
        borderRadius: '10px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px' 
      }}>
        <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '50%' }}>
          <FaUser style={{ color: '#e65100', fontSize: '20px' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>คนขับปัจจุบัน {isAdmin && <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>(Admin)</span>}</div>
          <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '16px' }}>{riderName || 'กำลังโหลด...'}</div>
        </div>
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
            const isCod = task.payment_method === 'เก็บเงินปลายทาง' || task.payment_method === 'เงินสด';
            const items = task.items || [];

            return (
              <div key={task.delivery_id} className={`rider-task-card status-${task.delivery_status.toLowerCase()}`}>
                <div className="task-card-header">
                  <div>
                    <span className="task-id-badge">#DEL-{task.delivery_id}</span>
                    <span className="task-order-ref">บิล #{task.order_id}</span>
                  </div>
                  <span className={`task-status-pill pill-${task.delivery_status.toLowerCase()}`}>
                    {task.delivery_status === 'OUT_FOR_DELIVERY' ? 'กำลังไปส่ง' : 'รอเตรียมของ'}
                  </span>
                </div>

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

                <div className="rider-quick-actions">
                  <a href={`tel:${task.customer_phone}`} className="btn-action btn-call">
                    <FaPhoneAlt /> โทรหาลูกค้า ({task.customer_phone})
                  </a>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.delivery_address)}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-action btn-map"
                  >
                    <FaMapMarkerAlt /> เปิดแผนที่นำทาง (Google Maps)
                  </a>
                </div>

                <div className="task-items-list">
                  <span className="items-title">รายการอาหาร/เครื่องดื่ม:</span>
                  {items.map((it, idx) => (
                    <div key={idx} className="item-row">
                      <span>{it.quantity}x {it.product_name}</span>
                      <span>฿{(it.price * it.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="item-row delivery-fee-row">
                    <span>ค่าจัดส่ง</span>
                    <span>฿{Number(task.delivery_fee).toLocaleString()}</span>
                  </div>
                </div>

                <div className={`payment-notice ${isCod ? 'notice-cod' : 'notice-paid'}`}>
                  <div className="payment-notice-left">
                    <FaMoneyBillWave />
                    <div>
                      <span className="notice-title">
                        {isCod ? 'เก็บเงินปลายทาง' : 'ชำระเงินเรียบร้อยแล้ว'}
                      </span>
                      <span className="notice-sub">
                        {isCod ? 'เรียกเก็บเงินจากลูกค้า (เงินสดหรือสแกนโอน)' : 'ลูกค้าชำระเงินแล้ว ไม่ต้องเก็บเงินเพิ่ม'}
                      </span>
                    </div>
                  </div>
                  <span className="notice-amount">
                    ฿{Number(task.total_amount).toLocaleString()}
                  </span>
                </div>

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
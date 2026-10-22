// ==============================================================================
// ไฟล์: front_end/src/pages/DeliveryPage.jsx
// ระบบ: แดชบอร์ดจัดการการจัดส่งสินค้า (Delivery Management Dashboard)
// หน้าที่: 
//   - สำหรับผู้จัดการร้านหรือแคชเชียร์ใช้ตรวจสอบรายการจัดส่งทั้งหมด
//   - มอบหมายงานให้ไรเดอร์ (Assign Rider)
//   - กรองดูสถานะออเดอร์ (รอดำเนินการ, กำลังเตรียม, กำลังจัดส่ง, ส่งสำเร็จ)
//   - ตรวจสอบที่อยู่ลูกค้า, ลิงก์แผนที่ Google Maps, ค่าจัดส่ง และยอดเก็บเงิน
// ==============================================================================

import React, { useState, useEffect } from 'react';
import './DeliveryPage.css';
import { 
  FaMotorcycle, 
  FaPhoneAlt, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaClock, 
  FaUserCheck, 
  FaMobileAlt, 
  FaSyncAlt, 
  FaExternalLinkAlt 
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

export default function DeliveryPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - deliveries: รายการจัดส่งที่ดึงมาจากฐานข้อมูล
  // - riders: รายชื่อพนักงานที่สามารถส่งของได้ เพื่อนำไปใส่ใน Select Dropdown
  // - statusFilter: สถานะที่เลือกกรอง เช่น 'ALL', 'PENDING', 'OUT_FOR_DELIVERY'
  // - loading: สถานะกำลังโหลดข้อมูล
  // ----------------------------------------------------------------------------
  const [deliveries, setDeliveries] = useState([]);
  const [riders, setRiders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // เมื่อเริ่มต้นคอมโพเนนต์ หรือเมื่อเปลี่ยนแถบสถานะ (statusFilter) ให้ดึงข้อมูลใหม่
  useEffect(() => {
    fetchDeliveries();
    fetchRiders();
  }, [statusFilter]);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายการจัดส่งจาก Backend ตามสถานะที่เลือก
  // ----------------------------------------------------------------------------
  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      // เรียกใช้ relative path '/api/...' เพื่อให้ Vite Proxy วิ่งไปยังพอร์ต 5000 อัตโนมัติ
      const url = statusFilter === 'ALL' 
        ? '/api/deliveries'
        : `/api/deliveries?status=${statusFilter}`;
      const response = await fetch(url);
      if (response.ok) {
        setDeliveries(await response.json());
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายชื่อพนักงานสำหรับนำมาเลือกเป็นไรเดอร์
  // ----------------------------------------------------------------------------
  const fetchRiders = async () => {
    try {
      const response = await fetch('/api/deliveries/riders');
      if (response.ok) {
        setRiders(await response.json());
      }
    } catch (error) {
      console.error('Error fetching riders:', error);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปลี่ยนสถานะการจัดส่ง (เช่น จาก 'กำลังเตรียม' -> 'กำลังจัดส่ง')
  // ----------------------------------------------------------------------------
  const handleUpdateStatus = async (deliveryId, newStatus) => {
    try {
      const response = await fetch(`/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'อัปเดตสถานะสำเร็จ!',
          timer: 1200,
          showConfirmButton: false
        });
        fetchDeliveries(); // ดึงข้อมูลใหม่เพื่อรีเฟรชหน้าจอ
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: มอบหมายไรเดอร์ให้ออเดอร์จัดส่ง
  // ----------------------------------------------------------------------------
  const handleAssignRider = async (deliveryId, riderId) => {
    try {
      const response = await fetch(`/api/deliveries/${deliveryId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rider_id: riderId })
      });
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'มอบหมายไรเดอร์สำเร็จ!',
          timer: 1200,
          showConfirmButton: false
        });
        fetchDeliveries(); // ดึงข้อมูลใหม่เพื่อแสดงชื่อไรเดอร์ที่เลือก
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถมอบหมายไรเดอร์ได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // Helper: แปลงสถานะภาษาอังกฤษเป็นป้าย Badge สีสันสวยงามพร้อมไอคอน
  // ----------------------------------------------------------------------------
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="status-badge badge-pending"><FaClock /> รอดำเนินการ</span>;
      case 'PREPARING':
        return <span className="status-badge badge-preparing"><FaClock /> กำลังเตรียม</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="status-badge badge-shipping"><FaMotorcycle /> กำลังจัดส่ง</span>;
      case 'DELIVERED':
        return <span className="status-badge badge-delivered"><FaCheckCircle /> ส่งสำเร็จ</span>;
      case 'CANCELLED':
        return <span className="status-badge badge-cancelled">ยกเลิก</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="delivery-page-container">
      {/* ส่วนหัวของหน้าจอ พร้อมปุ่มลัดเปิดหน้าจอมือถือไรเดอร์ */}
      <div className="delivery-header">
        <div>
          <h2><FaMotorcycle /> จัดการการจัดส่งสินค้า (Delivery Management)</h2>
          <p className="delivery-subtitle">ติดตามสถานะออเดอร์จัดส่ง มอบหมายไรเดอร์ และค่าจัดส่ง</p>
        </div>

        <div className="delivery-header-actions">
          {/* ลิงก์สำหรับเปิดหน้าจอมือถือไรเดอร์ในแท็บใหม่ เพื่อทดสอบหรือแสดง QR Code */}
          <Link to="/rider-delivery" target="_blank" className="btn-open-mobile-rider">
            <FaMobileAlt /> เปิดหน้าจอมือถือไรเดอร์ (Rider View) <FaExternalLinkAlt style={{ fontSize: '11px' }} />
          </Link>
          <button className="btn-delivery-refresh" onClick={fetchDeliveries}>
            <FaSyncAlt /> รีเฟรช
          </button>
        </div>
      </div>

      {/* แท็บกรองสถานะการจัดส่ง (Filter Tabs) */}
      <div className="delivery-filter-tabs">
        {[
          { id: 'ALL', label: 'ทั้งหมด' },
          { id: 'PENDING', label: 'รอดำเนินการ' },
          { id: 'PREPARING', label: 'กำลังเตรียม' },
          { id: 'OUT_FOR_DELIVERY', label: 'กำลังจัดส่ง 🛵' },
          { id: 'DELIVERED', label: 'ส่งสำเร็จ' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`delivery-tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ตารางแสดงรายการจัดส่งสินค้า */}
      <div className="delivery-table-container">
        {loading ? (
          <div className="delivery-loading">กำลังโหลดข้อมูลการจัดส่ง...</div>
        ) : deliveries.length === 0 ? (
          <div className="delivery-empty">
            <FaMotorcycle style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '10px' }} />
            <p>ยังไม่มีรายการจัดส่งในสถานะนี้</p>
          </div>
        ) : (
          <table className="delivery-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>เลขที่จัดส่ง</th>
                <th style={{ width: '8%' }}>บิลออเดอร์</th>
                <th style={{ width: '16%' }}>ข้อมูลลูกค้า</th>
                <th style={{ width: '22%' }}>ที่อยู่จัดส่ง</th>
                <th style={{ width: '12%' }}>ค่าส่ง / ยอดรวม</th>
                <th style={{ width: '16%' }}>พนักงานส่ง (Rider)</th>
                <th style={{ width: '10%' }}>สถานะ</th>
                <th style={{ width: '8%', textAlign: 'center' }}>เปลี่ยนสถานะ</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((del) => (
                <tr key={del.delivery_id}>
                  <td><strong>#DEL-{del.delivery_id}</strong></td>
                  <td><span className="order-tag">#{del.order_id}</span></td>
                  <td>
                    <div className="cust-info">
                      <strong>{del.customer_name}</strong>
                      {/* แท็ก tel: ช่วยให้สามารถคลิกโทรออกได้ทันที */}
                      <a href={`tel:${del.customer_phone}`} className="phone-link">
                        <FaPhoneAlt /> {del.customer_phone}
                      </a>
                    </div>
                  </td>
                  <td>
                    <div className="address-box">
                      <p className="address-text">{del.delivery_address}</p>
                      {/* สร้างลิงก์ค้นหาบน Google Maps โดยใช้ encodeURIComponent เพื่อรองรับภาษาไทย */}
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(del.delivery_address)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="map-link"
                      >
                        <FaMapMarkerAlt /> ดูแผนที่ Google Maps
                      </a>
                    </div>
                  </td>
                  <td>
                    <div className="amount-info">
                      <span className="del-fee">ค่าส่ง: ฿{Number(del.delivery_fee).toLocaleString()}</span>
                      <strong className="order-total">รวม: ฿{Number(del.total_amount).toLocaleString()}</strong>
                      <span className="pay-tag">{del.payment_method}</span>
                    </div>
                  </td>
                  <td>
                    {/* เลือกมอบหมายไรเดอร์คนใดคนหนึ่ง */}
                    <select
                      className="rider-select"
                      value={del.rider_id || ''}
                      onChange={(e) => handleAssignRider(del.delivery_id, e.target.value)}
                    >
                      <option value="">-- ยังไม่มอบหมาย --</option>
                      {riders.map((r) => (
                        <option key={r.employee_id} value={r.employee_id}>
                          {r.first_name} {r.last_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{getStatusBadge(del.delivery_status)}</td>
                  <td>
                    {/* เปลี่ยนสถานะออเดอร์โดยตรงจากตาราง */}
                    <select
                      className="status-select"
                      value={del.delivery_status}
                      onChange={(e) => handleUpdateStatus(del.delivery_id, e.target.value)}
                    >
                      <option value="PENDING">รอดำเนินการ</option>
                      <option value="PREPARING">กำลังเตรียม</option>
                      <option value="OUT_FOR_DELIVERY">กำลังจัดส่ง</option>
                      <option value="DELIVERED">ส่งสำเร็จ</option>
                      <option value="CANCELLED">ยกเลิก</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

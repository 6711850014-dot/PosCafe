// ==============================================================================
// ไฟล์: front_end/src/pages/PromotionsPage.jsx
// ระบบ: การจัดการโปรโมชั่นส่วนลด (Promotion Management UI)
// วัตถุประสงค์:
//   - ให้ผู้จัดการร้านสร้าง/แก้ไขโปรโมชั่นส่วนลดแบบรายเมนูเป็นเปอร์เซ็นต์ (%)
//   - เลือกสินค้าที่ร่วมรายการได้แบบทีละเมนู หรือกด "เลือกทั้งหมด"
//   - มี Live Preview แสดงราคาเดิมขีดฆ่า และราคาใหม่หลังหักส่วนลดทันที
//   - สลับเปิด/ปิดการใช้งานโปรโมชั่นได้แบบ Real-time (One-click toggle)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import './PromotionsPage.css';
import { 
  FaTag, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaTimes, 
  FaPercent, 
  FaCalendarAlt, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaToggleOn, 
  FaToggleOff 
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function PromotionsPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - promotions: รายการโปรโมชั่นทั้งหมดที่ดึงมาจากฐานข้อมูล
  // - products: รายการสินค้าทั้งหมดในร้าน เพื่อนำมาให้เลือกผูกกับโปรโมชั่น
  // - showModal: ควบคุมการเปิด/ปิด Pop-up Modal สร้างหรือแก้ไขโปรโมชั่น
  // - isEditing: บอกว่ากำลัง "แก้ไข" (true) หรือ "สร้างใหม่" (false)
  // - loading: สถานะกำลังโหลดข้อมูล
  // - formData: ข้อมูลในฟอร์ม (ชื่อ, รายละเอียด, % ลด, วันที่, สินค้าที่เลือก)
  // ----------------------------------------------------------------------------
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    promotion_id: null,
    promotion_name: '',
    description: '',
    discount_percentage: 10,
    start_date: new Date().toISOString().slice(0, 10), // ค่าเริ่มต้น: วันนี้
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // ค่าเริ่มต้น: อีก 30 วัน
    product_ids: [] // รายการรหัสสินค้าที่เลือกเข้าร่วมโปรโมชั่น
  });

  // โหลดรายการโปรโมชั่นและสินค้าทันทีเมื่อเปิดหน้านี้
  useEffect(() => {
    fetchPromotions();
    fetchProducts();
  }, []);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงข้อมูลโปรโมชั่นทั้งหมดจาก Backend
  // ----------------------------------------------------------------------------
  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/promotions');
      if (response.ok) {
        setPromotions(await response.json());
      }
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายการสินค้าทั้งหมดในร้าน
  // ----------------------------------------------------------------------------
  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        setProducts(await response.json());
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปิด Modal สำหรับ "สร้างโปรโมชั่นใหม่"
  // ----------------------------------------------------------------------------
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({
      promotion_id: null,
      promotion_name: '',
      description: '',
      discount_percentage: 10,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      product_ids: []
    });
    setShowModal(true);
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปิด Modal สำหรับ "แก้ไขโปรโมชั่นเดิม" (โหลดข้อมูลเดิมใส่ในฟอร์ม)
  // ----------------------------------------------------------------------------
  const handleOpenEditModal = (promo) => {
    setIsEditing(true);
    const prodIds = Array.isArray(promo.products) ? promo.products.map(p => p.product_id) : [];
    setFormData({
      promotion_id: promo.promotion_id,
      promotion_name: promo.promotion_name,
      description: promo.description || '',
      discount_percentage: Number(promo.discount_percentage),
      start_date: promo.start_date,
      end_date: promo.end_date,
      product_ids: prodIds
    });
    setShowModal(true);
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: คลิกเลือก/ยกเลิกเลือก สินค้าทีละรายการในฟอร์ม
  // ----------------------------------------------------------------------------
  const handleToggleProduct = (productId) => {
    const current = formData.product_ids || [];
    if (current.includes(productId)) {
      setFormData({ ...formData, product_ids: current.filter(id => id !== productId) });
    } else {
      setFormData({ ...formData, product_ids: [...current, productId] });
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ปุ่มลัดเลือกสินค้าทั้งหมด
  // ----------------------------------------------------------------------------
  const handleSelectAllProducts = () => {
    setFormData({ ...formData, product_ids: products.map(p => p.product_id) });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ปุ่มลัดล้างการเลือกสินค้าทั้งหมด
  // ----------------------------------------------------------------------------
  const handleClearAllProducts = () => {
    setFormData({ ...formData, product_ids: [] });
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: บันทึกข้อมูลโปรโมชั่น (ตรวจสอบความถูกต้อง และยิง API POST / PUT)
  // ----------------------------------------------------------------------------
  const handleSavePromotion = async (e) => {
    e.preventDefault();
    if (!formData.promotion_name.trim()) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อโปรโมชั่น', 'warning');
    }
    if (!formData.discount_percentage || formData.discount_percentage <= 0 || formData.discount_percentage > 100) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุเปอร์เซ็นต์ส่วนลดให้ถูกต้อง (1 - 100%)', 'warning');
    }
    if (formData.product_ids.length === 0) {
      return Swal.fire('แจ้งเตือน', 'กรุณาเลือกสินค้าที่ต้องการลดราคาอย่างน้อย 1 รายการ', 'warning');
    }

    const url = isEditing 
      ? `/api/promotions/${formData.promotion_id}`
      : '/api/promotions';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: isEditing ? 'แก้ไขโปรโมชั่นสำเร็จ!' : 'สร้างโปรโมชั่นสำเร็จ!',
          text: 'ระบบจะนำไปคำนวณส่วนลดอัตโนมัติที่หน้าขาย POS ทันที',
          timer: 1800,
          showConfirmButton: false
        });
        setShowModal(false);
        fetchPromotions(); // รีเฟรชรายการ
      } else {
        const data = await response.json();
        Swal.fire('ผิดพลาด', data.message || 'ไม่สามารถบันทึกได้', 'error');
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: สลับเปิด/ปิดการใช้งานโปรโมชั่น (Toggle is_active)
  // ----------------------------------------------------------------------------
  const handleToggleActive = async (promoId) => {
    try {
      const response = await fetch(`/api/promotions/${promoId}/toggle`, {
        method: 'PUT'
      });
      if (response.ok) {
        fetchPromotions();
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ลบโปรโมชั่น พร้อมกล่องยืนยัน SweetAlert2
  // ----------------------------------------------------------------------------
  const handleDelete = (promoId, promoName) => {
    Swal.fire({
      title: 'ยืนยันการลบโปรโมชั่น?',
      text: `คุณต้องการลบ "${promoName}" ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`/api/promotions/${promoId}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            Swal.fire('ลบสำเร็จ!', 'โปรโมชั่นถูกลบแล้ว', 'success');
            fetchPromotions();
          }
        } catch (error) {
          Swal.fire('ผิดพลาด', 'ไม่สามารถลบโปรโมชั่นได้', 'error');
        }
      }
    });
  };

  return (
    <div className="promo-page-container">
      {/* ส่วนหัวของหน้าโปรโมชั่น */}
      <div className="promo-header">
        <div>
          <h2><FaTag /> จัดการโปรโมชั่น (Promotion Management)</h2>
          <p className="promo-subtitle">
            กำหนดส่วนลด % รายเมนูสินค้า ระบบจะคำนวณส่วนลดให้อัตโนมัติเมื่อคิดเงินที่หน้า POS
          </p>
        </div>

        <button className="btn-add-promo" onClick={handleOpenAddModal}>
          <FaPlus /> สร้างโปรโมชั่นใหม่
        </button>
      </div>

      {/* Grid แสดงการ์ดโปรโมชั่นทั้งหมด */}
      <div className="promo-grid">
        {loading ? (
          <div className="promo-loading">กำลังโหลดโปรโมชั่น...</div>
        ) : promotions.length === 0 ? (
          <div className="promo-empty">
            <FaTag style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '10px' }} />
            <p>ยังไม่มีโปรโมชั่น กดปุ่ม "สร้างโปรโมชั่นใหม่" ด้านบนเพื่อเริ่มใช้งาน</p>
          </div>
        ) : (
          promotions.map((promo) => {
            const isExpired = promo.status === 'EXPIRED';
            const isDisabled = promo.status === 'DISABLED';
            const prods = Array.isArray(promo.products) ? promo.products : [];

            return (
              <div key={promo.promotion_id} className={`promo-card ${isDisabled ? 'disabled' : ''} ${isExpired ? 'expired' : ''}`}>
                {/* แถบด้านบนของการ์ด: ป้ายลดกี่ % และสวิตช์เปิด/ปิด */}
                <div className="promo-card-top">
                  <div className="promo-badge-percent">
                    <FaPercent /> ลด {promo.discount_percentage}%
                  </div>
                  <div className="promo-toggle-action">
                    <button 
                      className={`btn-toggle ${promo.is_active ? 'active' : ''}`}
                      onClick={() => handleToggleActive(promo.promotion_id)}
                      title={promo.is_active ? 'คลิกเพื่อปิดการใช้งาน' : 'คลิกเพื่อเปิดการใช้งาน'}
                    >
                      {promo.is_active ? <FaToggleOn /> : <FaToggleOff />}
                      <span>{promo.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                    </button>
                  </div>
                </div>

                <h3 className="promo-card-title">{promo.promotion_name}</h3>
                {promo.description && <p className="promo-card-desc">{promo.description}</p>}

                {/* แสดงช่วงวันที่ใช้งานได้ */}
                <div className="promo-dates">
                  <FaCalendarAlt /> {promo.start_date} ถึง {promo.end_date}
                  {isExpired && <span className="tag-expired">(หมดอายุแล้ว)</span>}
                </div>

                {/* รายการสินค้าที่ร่วมรายการ */}
                <div className="promo-products-box">
                  <span className="products-label">สินค้าที่ร่วมรายการ ({prods.length} เมนู):</span>
                  <div className="products-tags-wrap">
                    {prods.map(p => (
                      <span key={p.product_id} className="prod-promo-pill">
                        {p.product_name} (฿{p.price})
                      </span>
                    ))}
                  </div>
                </div>

                {/* ปุ่มจัดการ: แก้ไข และ ลบ */}
                <div className="promo-card-footer">
                  <button className="btn-promo-edit" onClick={() => handleOpenEditModal(promo)}>
                    <FaEdit /> แก้ไข
                  </button>
                  <button className="btn-promo-delete" onClick={() => handleDelete(promo.promotion_id, promo.promotion_name)}>
                    <FaTrash /> ลบ
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pop-up Modal สร้าง / แก้ไขโปรโมชั่น */}
      {showModal && (
        <div className="promo-modal-overlay">
          <div className="promo-modal-box">
            <div className="promo-modal-header">
              <div>
                <h3>{isEditing ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่ (ส่วนลด % รายเมนู)'}</h3>
                <p className="modal-sub">ระบบจะตรวจจับและคำนวณส่วนลดอัตโนมัติในหน้า POS</p>
              </div>
              <button className="promo-close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>

            <form onSubmit={handleSavePromotion}>
              <div className="form-group">
                <label>ชื่อโปรโมชั่น *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="เช่น โปรรับหน้าร้อน ลด 15% เมนูกาแฟ"
                  value={formData.promotion_name}
                  onChange={(e) => setFormData({ ...formData, promotion_name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 160px' }}>
                  <label>ส่วนลด (%) *</label>
                  <div className="input-with-icon">
                    <input 
                      type="number" 
                      required 
                      min="1" 
                      max="100"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                    />
                    <span className="icon-suffix">%</span>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>รายละเอียดเพิ่มเติม</label>
                  <input 
                    type="text" 
                    placeholder="เงื่อนไขหรือหมายเหตุโปรโมชั่น"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันที่เริ่มต้น *</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันที่สิ้นสุด *</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* ส่วนเลือกสินค้าที่ร่วมรายการ พร้อมแสดง Live Preview ราคาหลังหักลด */}
              <div className="products-selection-section">
                <div className="selection-header">
                  <label className="section-title-label">
                    เลือกสินค้าที่ต้องการลดราคา * (เลือกแล้ว {formData.product_ids.length} รายการ)
                  </label>
                  <div className="quick-btn-group">
                    <button type="button" className="btn-text" onClick={handleSelectAllProducts}>เลือกทั้งหมด</button>
                    <span>|</span>
                    <button type="button" className="btn-text" onClick={handleClearAllProducts}>ล้างทั้งหมด</button>
                  </div>
                </div>

                <div className="products-grid-select">
                  {products.map(p => {
                    const isSelected = formData.product_ids.includes(p.product_id);
                    // คำนวณราคาจำลองหลังหักส่วนลดแบบ Real-time
                    const discountedPrice = Math.round(Number(p.price) * (1 - formData.discount_percentage / 100));

                    return (
                      <div 
                        key={p.product_id}
                        className={`product-select-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleProduct(p.product_id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {}}
                        />
                        <div className="prod-select-info">
                          <span className="p-name">{p.product_name}</span>
                          <span className="p-price">
                            {isSelected ? (
                              <span>
                                <del>฿{p.price}</del> <strong>฿{discountedPrice}</strong>
                              </span>
                            ) : (
                              <span>฿{p.price}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="promo-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-save">บันทึกโปรโมชั่น</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

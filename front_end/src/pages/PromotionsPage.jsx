// ==============================================================================
// ไฟล์: front_end/src/pages/PromotionsPage.jsx
// ระบบ: การจัดการโปรโมชั่นส่วนลด (Promotion Management UI)
// การปรับปรุง:
//   1. แสดงรหัสโปรโมชั่น (#PR-XX) และสถานะชัดเจน (Active, Upcoming, Expired, Disabled)
//   2. ป้องกันการตั้งชื่อโปรโมชั่นซ้ำ และตรวจสอบช่วงเวลาทับซ้อนกันแบบ Real-time
//   3. ตรวจสอบสินค้าที่ร่วมรายการ เพื่อลดการซ้อนทับของโปรโมชั่น (Overlap Prevention)
//   4. รองรับการกรองตามสถานะและค้นหาชื่อโปรโมชั่น
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
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
  FaToggleOff,
  FaSearch,
  FaFilter,
  FaClock,
  FaBan
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formData, setFormData] = useState({
    promotion_id: null,
    promotion_name: '',
    description: '',
    discount_percentage: 10,
    start_date: new Date().toISOString().slice(0, 10), // วันนี้
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // อีก 30 วัน
    product_ids: []
  });

  // โหลดรายการโปรโมชั่นและสินค้าทันทีเมื่อเปิดหน้านี้
  useEffect(() => {
    fetchPromotions();
    fetchProducts();
  }, []);

  // ดึงข้อมูลโปรโมชั่นทั้งหมดจาก Backend
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

  // ดึงรายการสินค้าทั้งหมดในร้าน
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

  // เปิด Modal สร้างโปรโมชั่นใหม่
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

  // เปิด Modal แก้ไขโปรโมชั่นเดิม
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

  // คลิกเลือก/ยกเลิกเลือก สินค้า
  const handleToggleProduct = (productId) => {
    const current = formData.product_ids || [];
    if (current.includes(productId)) {
      setFormData({ ...formData, product_ids: current.filter(id => id !== productId) });
    } else {
      setFormData({ ...formData, product_ids: [...current, productId] });
    }
  };

  // ปุ่มลัดเลือกสินค้าทั้งหมด
  const handleSelectAllProducts = () => {
    setFormData({ ...formData, product_ids: products.map(p => p.product_id) });
  };

  // ปุ่มลัดล้างการเลือกสินค้าทั้งหมด
  const handleClearAllProducts = () => {
    setFormData({ ...formData, product_ids: [] });
  };

  // ตรวจสอบสินค้าที่กำลังซ้อนทับกับโปรโมชั่นอื่นในช่วงเวลาที่เลือก
  const overlappingProductMap = useMemo(() => {
    const map = {};
    if (!formData.start_date || !formData.end_date) return map;

    promotions.forEach(promo => {
      // ข้ามโปรโมชั่นที่กำลังแก้ไขอยู่ หรือโปรโมชั่นที่ปิดการใช้งาน
      if (isEditing && promo.promotion_id === formData.promotion_id) return;
      if (!promo.is_active) return;

      // ตรวจสอบว่าช่วงเวลาทับซ้อนกันหรือไม่
      const isDateOverlapping = (formData.start_date <= promo.end_date && formData.end_date >= promo.start_date);
      if (isDateOverlapping && Array.isArray(promo.products)) {
        promo.products.forEach(p => {
          map[p.product_id] = {
            promotion_id: promo.promotion_id,
            promotion_name: promo.promotion_name,
            discount_percentage: promo.discount_percentage
          };
        });
      }
    });
    return map;
  }, [promotions, formData.start_date, formData.end_date, formData.promotion_id, isEditing]);

  // บันทึกข้อมูลโปรโมชั่น (ตรวจสอบความถูกต้องและป้องกันความซ้ำซ้อน)
  const handleSavePromotion = async (e) => {
    e.preventDefault();
    const cleanName = formData.promotion_name.trim();

    if (!cleanName) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อโปรโมชั่น', 'warning');
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      return Swal.fire('แจ้งเตือน', 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น', 'warning');
    }

    if (!formData.discount_percentage || formData.discount_percentage <= 0 || formData.discount_percentage > 100) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุเปอร์เซ็นต์ส่วนลดให้ถูกต้อง (1 - 100%)', 'warning');
    }

    if (formData.product_ids.length === 0) {
      return Swal.fire('แจ้งเตือน', 'กรุณาเลือกสินค้าที่ต้องการลดราคาอย่างน้อย 1 รายการ', 'warning');
    }

    // Client-side Validation: ตรวจสอบเฉพาะ Exact Duplicate (ชื่อเดียวกัน + %เท่ากัน + ช่วงเวลาทับซ้อน)
    const exactDuplicate = promotions.find(p => {
      if (isEditing && p.promotion_id === formData.promotion_id) return false;
      const sameName = p.promotion_name.trim().toLowerCase() === cleanName.toLowerCase();
      const sameDiscount = Number(p.discount_percentage) === Number(formData.discount_percentage);
      const hasDateOverlap = (formData.start_date <= p.end_date && formData.end_date >= p.start_date);
      return sameName && sameDiscount && hasDateOverlap;
    });

    if (exactDuplicate) {
      return Swal.fire({
        icon: 'warning',
        title: 'พบโปรโมชั่นซ้ำกันทั้งหมด!',
        html: `พบโปรโมชั่นชื่อ <b>"${exactDuplicate.promotion_name}"</b> (รหัส #PR-${exactDuplicate.promotion_id}) ที่มีชื่อ เปอร์เซ็นต์ลด (${exactDuplicate.discount_percentage}%) และช่วงเวลาซ้ำซ้อนกันในระบบแล้ว<br/><br/>กรุณาเปลี่ยนชื่อ หรือเปอร์เซ็นต์ลด หรือช่วงเวลาให้แตกต่างอย่างน้อย 1 อย่าง`
      });
    }

    const url = isEditing 
      ? `/api/promotions/${formData.promotion_id}`
      : '/api/promotions';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          promotion_name: cleanName
        })
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: isEditing ? 'แก้ไขโปรโมชั่นสำเร็จ!' : 'สร้างโปรโมชั่นสำเร็จ!',
          text: 'ระบบบันทึกเงื่อนไขและจะนำไปคำนวณราคาพิเศษที่หน้า POS ทันที',
          timer: 1800,
          showConfirmButton: false
        });
        setShowModal(false);
        fetchPromotions();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ไม่สามารถบันทึกโปรโมชั่นได้',
          html: data.message || 'เกิดข้อผิดพลาดในการตรวจสอบเงื่อนไขโปรโมชั่น'
        });
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    }
  };

  // สลับเปิด/ปิดการใช้งานโปรโมชั่น
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

  // ลบโปรโมชั่น
  const handleDelete = (promoId, promoName) => {
    Swal.fire({
      title: 'ยืนยันการลบโปรโมชั่น?',
      html: `คุณต้องการลบโปรโมชั่น <b>"${promoName}"</b> (รหัส #PR-${promoId}) ใช่หรือไม่?`,
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
            Swal.fire('ลบสำเร็จ!', 'โปรโมชั่นถูกลบเรียบร้อยแล้ว', 'success');
            fetchPromotions();
          }
        } catch (error) {
          Swal.fire('ผิดพลาด', 'ไม่สามารถลบโปรโมชั่นได้', 'error');
        }
      }
    });
  };

  // กรองโปรโมชั่นตาม Search และ Status
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      const matchSearch = p.promotion_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          `pr-${p.promotion_id}`.includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [promotions, searchTerm, statusFilter]);

  // Helper แสดงป้ายสถานะ
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="promo-status-badge status-active"><FaCheckCircle /> กำลังใช้งาน</span>;
      case 'UPCOMING':
        return <span className="promo-status-badge status-upcoming"><FaClock /> เร็วๆ นี้</span>;
      case 'EXPIRED':
        return <span className="promo-status-badge status-expired"><FaBan /> หมดอายุแล้ว</span>;
      case 'DISABLED':
      default:
        return <span className="promo-status-badge status-disabled"><FaExclamationCircle /> ปิดใช้งาน</span>;
    }
  };

  return (
    <div className="promo-page-container">
      {/* ส่วนหัวของหน้าโปรโมชั่น */}
      <div className="promo-header">
        <div>
          <h2><FaTag /> จัดการโปรโมชั่น (Promotion Management)</h2>
          <p className="promo-subtitle">
            กำหนดส่วนลด % รายเมนูสินค้า มีระบบป้องกันชื่อซ้ำและตรวจสอบความซ้ำซ้อนของโปรโมชั่นอัตโนมัติ
          </p>
        </div>

        <button className="btn-add-promo" onClick={handleOpenAddModal}>
          <FaPlus /> สร้างโปรโมชั่นใหม่
        </button>
      </div>

      {/* แถบตัวกรองและช่องค้นหา */}
      <div className="promo-toolbar">
        <div className="promo-search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อโปรโมชั่น หรือรหัส..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="promo-filter-group">
          <FaFilter className="filter-icon" />
          <button 
            type="button" 
            className={`filter-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            ทั้งหมด ({promotions.length})
          </button>
          <button 
            type="button" 
            className={`filter-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            กำลังใช้งาน
          </button>
          <button 
            type="button" 
            className={`filter-btn ${statusFilter === 'UPCOMING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('UPCOMING')}
          >
            เร็วๆ นี้
          </button>
          <button 
            type="button" 
            className={`filter-btn ${statusFilter === 'EXPIRED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('EXPIRED')}
          >
            หมดอายุ
          </button>
          <button 
            type="button" 
            className={`filter-btn ${statusFilter === 'DISABLED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DISABLED')}
          >
            ปิดใช้งาน
          </button>
        </div>
      </div>

      {/* Grid แสดงการ์ดโปรโมชั่นทั้งหมด */}
      <div className="promo-grid">
        {loading ? (
          <div className="promo-loading">กำลังโหลดข้อมูลโปรโมชั่น...</div>
        ) : filteredPromotions.length === 0 ? (
          <div className="promo-empty">
            <FaTag style={{ fontSize: '42px', color: '#cbd5e1', marginBottom: '12px' }} />
            <p>ไม่พบรายการโปรโมชั่นที่ตรงกับเงื่อนไขการค้นหา</p>
          </div>
        ) : (
          filteredPromotions.map((promo) => {
            const isExpired = promo.status === 'EXPIRED';
            const isDisabled = promo.status === 'DISABLED';
            const prods = Array.isArray(promo.products) ? promo.products : [];

            return (
              <div 
                key={promo.promotion_id} 
                className={`promo-card ${isDisabled ? 'disabled' : ''} ${isExpired ? 'expired' : ''}`}
              >
                {/* แถบด้านบนของการ์ด: รหัสโปรโมชั่น, ป้ายลดกี่ % และสถานะ */}
                <div className="promo-card-top">
                  <div className="promo-top-left">
                    <span className="promo-id-tag">#PR-{promo.promotion_id}</span>
                    <div className="promo-badge-percent">
                      <FaPercent /> ลด {promo.discount_percentage}%
                    </div>
                  </div>
                  <div className="promo-toggle-action">
                    <button 
                      className={`btn-toggle ${promo.is_active ? 'active' : ''}`}
                      onClick={() => handleToggleActive(promo.promotion_id)}
                      title={promo.is_active ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                    >
                      {promo.is_active ? <FaToggleOn /> : <FaToggleOff />}
                      <span>{promo.is_active ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
                    </button>
                  </div>
                </div>

                <div className="promo-title-row">
                  <h3 className="promo-card-title">{promo.promotion_name}</h3>
                  {renderStatusBadge(promo.status)}
                </div>

                {promo.description && <p className="promo-card-desc">{promo.description}</p>}

                {/* แสดงช่วงวันที่ใช้งานได้ */}
                <div className="promo-dates">
                  <FaCalendarAlt /> 
                  <span>{promo.start_date} ถึง {promo.end_date}</span>
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
                <h3>
                  {isEditing ? `แก้ไขโปรโมชั่น (#PR-${formData.promotion_id})` : 'สร้างโปรโมชั่นใหม่ (ส่วนลด % รายเมนู)'}
                </h3>
                <p className="modal-sub">
                  ระบบจะตรวจสอบป้องกันชื่อซ้ำ และลดการซ้อนทับของส่วนลดอัตโนมัติ
                </p>
              </div>
              <button className="promo-close-btn" onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSavePromotion}>
              <div className="form-group">
                <label>ชื่อโปรโมชั่น * <span className="label-tip">(ห้ามตั้งชื่อซ้ำในช่วงเวลาเดียวกัน)</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="เช่น โปรรับหน้าร้อน เมนูกาแฟลด 15%"
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
                    min={formData.start_date}
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* ส่วนเลือกสินค้าที่ร่วมรายการ พร้อมแสดง Live Preview และแจ้งเตือน Overlap */}
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
                    const conflict = overlappingProductMap[p.product_id];
                    const discountedPrice = Math.round(Number(p.price) * (1 - formData.discount_percentage / 100));

                    return (
                      <div 
                        key={p.product_id}
                        className={`product-select-card ${isSelected ? 'selected' : ''} ${conflict ? 'has-conflict' : ''}`}
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
                          {conflict && (
                            <span 
                              className="conflict-badge" 
                              title={`สินค้ามีโปรโมชั่น "${conflict.promotion_name}" (${conflict.discount_percentage}%) ซ้อนทับอยู่`}
                            >
                              <FaExclamationCircle /> ติดโปร #PR-{conflict.promotion_id}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="promo-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-save">
                  บันทึกโปรโมชั่น
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

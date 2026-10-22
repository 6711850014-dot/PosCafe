// ==============================================================================
// ไฟล์: front_end/src/pages/ProcurementPage.jsx
// ระบบ: การจัดซื้อวัตถุดิบ (Material Procurement & Simple Receiving UI)
// วัตถุประสงค์:
//   - ให้ผู้จัดการหรือพนักงานตรวจรับ บันทึกรับวัตถุดิบเข้าคลัง (Simple Receiving)
//   - คำนวณราคารวมอัตโนมัติ (จำนวน x ราคาต่อหน่วย)
//   - เพิ่มล็อตเข้าคลังสต็อก (Inventory FIFO) ทันทีเพื่อพร้อมชงขาย
//   - สรุปตัวเลข KPI ค่าใช้จ่ายในการซื้อวัตถุดิบทั้งหมด และค่าเฉลี่ยต่อครั้ง
// ==============================================================================

import React, { useState, useEffect } from 'react';
import './ProcurementPage.css';
import { 
  FaBoxes, 
  FaPlus, 
  FaReceipt, 
  FaMoneyBillWave, 
  FaCalendarAlt, 
  FaStore, 
  FaTimes, 
  FaCheckCircle, 
  FaFilter, 
  FaSyncAlt 
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function ProcurementPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - procurements: รายการประวัติการจัดซื้อทั้งหมด
  // - ingredients: รายชื่อวัตถุดิบทั้งหมดสำหรับเลือกใน Dropdown
  // - summary: สรุปภาพรวมค่าใช้จ่ายจัดซื้อ (ยอดรวม, ยอดเฉลี่ย, สัดส่วนคู่ค้า)
  // - loading: สถานะกำลังโหลด
  // - showModal: ควบคุมการเปิด/ปิด Pop-up Modal บันทึกรับของ
  // - Filters: selectedIngredient, startDate, endDate
  // - formData: ข้อมูลในฟอร์มรับของ
  // ----------------------------------------------------------------------------
  const [procurements, setProcurements] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // ตัวกรอง (Filter States)
  const [selectedIngredient, setSelectedIngredient] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ข้อมูลฟอร์มรับวัตถุดิบ (Simple Receiving)
  const [formData, setFormData] = useState({
    ingredient_id: '',
    supplier_name: '',
    quantity: '',
    unit_cost: '',
    total_cost: '',
    purchase_date: new Date().toISOString().slice(0, 10), // วันที่ซื้อเริ่มต้น: วันนี้
    expiration_date: '',
    invoice_number: '',
    notes: ''
  });

  // โหลดข้อมูลเมื่อเปิดหน้า หรือเมื่อเปลี่ยนตัวกรองวัตถุดิบ
  useEffect(() => {
    fetchProcurements();
    fetchIngredients();
    fetchSummary();
  }, [selectedIngredient]);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงประวัติการจัดซื้อวัตถุดิบตามเงื่อนไขตัวกรอง
  // ----------------------------------------------------------------------------
  const fetchProcurements = async () => {
    setLoading(true);
    try {
      let url = `/api/procurements?ingredient_id=${selectedIngredient}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        setProcurements(await response.json());
      }
    } catch (error) {
      console.error('Error fetching procurements:', error);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงรายชื่อวัตถุดิบทั้งหมดจากคลังมาใส่ใน Dropdown
  // ----------------------------------------------------------------------------
  const fetchIngredients = async () => {
    try {
      const response = await fetch('/api/stock');
      if (response.ok) {
        const data = await response.json();
        setIngredients(data);
        if (data.length > 0 && !formData.ingredient_id) {
          setFormData(prev => ({ ...prev, ingredient_id: data[0].ingredient_id }));
        }
      }
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงตัวเลขสรุปภาพรวมค่าใช้จ่ายจัดซื้อ (Spend Summary)
  // ----------------------------------------------------------------------------
  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/procurements/summary');
      if (response.ok) {
        setSummary(await response.json());
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เปิด Modal รับของ พร้อมรีเซ็ตค่าในฟอร์ม
  // ----------------------------------------------------------------------------
  const handleOpenModal = () => {
    setFormData({
      ingredient_id: ingredients[0]?.ingredient_id || '',
      supplier_name: '',
      quantity: '',
      unit_cost: '',
      total_cost: '',
      purchase_date: new Date().toISOString().slice(0, 10),
      expiration_date: '',
      invoice_number: '',
      notes: ''
    });
    setShowModal(true);
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: คำนวณราคารวมอัตโนมัติแบบ Real-time เมื่อพิมพ์จำนวนหรือราคาต่อหน่วย
  // ----------------------------------------------------------------------------
  const handleQtyOrCostChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    const q = parseFloat(field === 'quantity' ? value : formData.quantity) || 0;
    const u = parseFloat(field === 'unit_cost' ? value : formData.unit_cost) || 0;
    updated.total_cost = (q * u).toFixed(2);
    setFormData(updated);
  };

  // ----------------------------------------------------------------------------
  // Helper: ดึงหน่วยนับ (เช่น กรัม, มิลลิลิตร, ซอง) ของวัตถุดิบที่กำลังเลือกอยู่
  // ----------------------------------------------------------------------------
  const getSelectedUnit = () => {
    const found = ingredients.find(i => i.ingredient_id === formData.ingredient_id);
    return found ? found.unit : 'หน่วย';
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: บันทึกรับวัตถุดิบเข้าคลัง (Simple Receiving)
  // - ตรวจสอบความถูกต้องของข้อมูล
  // - ดึง employee_id ของผู้ใช้ที่ล็อกอินอยู่มาบันทึกเป็นผู้รับของ
  // ----------------------------------------------------------------------------
  const handleSaveProcurement = async (e) => {
    e.preventDefault();
    if (!formData.ingredient_id || !formData.quantity || !formData.unit_cost) {
      return Swal.fire('แจ้งเตือน', 'กรุณาระบุวัตถุดิบ จำนวน และราคาให้ครบถ้วน', 'warning');
    }

    const loggedInUserStr = sessionStorage.getItem('user');
    let currentEmpId = 'E01';
    if (loggedInUserStr) {
      try {
        const userObj = JSON.parse(loggedInUserStr);
        currentEmpId = userObj.employee_id || 'E01';
      } catch (err) {}
    }

    try {
      Swal.fire({ title: 'กำลังบันทึกรับวัตถุดิบเข้าคลัง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const response = await fetch('/api/procurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          received_by: currentEmpId
        })
      });

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: 'ล็อตวัตถุดิบถูกเพิ่มเข้าสต็อก และพร้อมใช้งานในการขาย FIFO ทันที',
          timer: 2000,
          showConfirmButton: false
        });
        setShowModal(false);
        fetchProcurements();
        fetchSummary();
      } else {
        const data = await response.json();
        Swal.fire('ผิดพลาด', data.message || 'บันทึกไม่สำเร็จ', 'error');
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
    }
  };

  const totalSpent = summary?.overview?.total_spend || 0;
  const totalOrders = summary?.overview?.total_orders || 0;
  const avgSpend = summary?.overview?.avg_spend_per_purchase || 0;

  return (
    <div className="procure-page-container">
      {/* ส่วนหัวของหน้าจัดซื้อ */}
      <div className="procure-header">
        <div>
          <h2><FaBoxes /> การจัดซื้อวัตถุดิบ (Material Procurement)</h2>
          <p className="procure-subtitle">
            บันทึกรับวัตถุดิบเข้าสต็อก (Simple Receiving) พร้อมอัปเดตล็อต FIFO และคุมต้นทุนการซื้อ
          </p>
        </div>

        <button className="btn-add-procure" onClick={handleOpenModal}>
          <FaPlus /> บันทึกรับวัตถุดิบ (Simple Receiving)
        </button>
      </div>

      {/* แดชบอร์ดสรุป KPI การจัดซื้อ (Overview Cards) */}
      <div className="procure-kpi-grid">
        <div className="procure-kpi-card kpi-spend">
          <div className="kpi-icon-wrap"><FaMoneyBillWave /></div>
          <div>
            <span className="kpi-title">ยอดจัดซื้อสะสมทั้งหมด</span>
            <h3 className="kpi-number">฿{Number(totalSpent).toLocaleString()}</h3>
            <span className="kpi-sub">ค่าใช้จ่ายต้นทุนวัตถุดิบ</span>
          </div>
        </div>

        <div className="procure-kpi-card kpi-count">
          <div className="kpi-icon-wrap"><FaReceipt /></div>
          <div>
            <span className="kpi-title">จำนวนครั้งที่จัดซื้อ</span>
            <h3 className="kpi-number">{Number(totalOrders).toLocaleString()} ครั้ง</h3>
            <span className="kpi-sub">บันทึกรับของเข้าคลัง</span>
          </div>
        </div>

        <div className="procure-kpi-card kpi-avg">
          <div className="kpi-icon-wrap"><FaStore /></div>
          <div>
            <span className="kpi-title">ยอดจัดซื้อเฉลี่ยต่อบิล</span>
            <h3 className="kpi-number">฿{Number(avgSpend).toLocaleString()}</h3>
            <span className="kpi-sub">ค่าใช้จ่ายเฉลี่ยต่อครั้ง</span>
          </div>
        </div>
      </div>

      {/* แถบเครื่องมือค้นหาและกรองข้อมูล (Filter Toolbar) */}
      <div className="procure-filter-bar">
        <div className="filter-group-inline">
          <label><FaFilter /> กรองตามวัตถุดิบ:</label>
          <select 
            value={selectedIngredient}
            onChange={(e) => setSelectedIngredient(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">-- วัตถุดิบทั้งหมด --</option>
            {ingredients.map(i => (
              <option key={i.ingredient_id} value={i.ingredient_id}>
                {i.ingredient_name} ({i.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group-inline">
          <label><FaCalendarAlt /> ตั้งแต่วันที่:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="filter-date-input" 
          />
          <span>ถึง</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="filter-date-input" 
          />
          <button className="btn-filter-apply" onClick={fetchProcurements}>กรอง</button>
          <button className="btn-filter-reset" onClick={() => { setStartDate(''); setEndDate(''); setSelectedIngredient('ALL'); }}>ล้าง</button>
        </div>
      </div>

      {/* ตารางแสดงประวัติการจัดซื้อวัตถุดิบ */}
      <div className="procure-table-card">
        {loading ? (
          <div className="procure-loading">กำลังโหลดประวัติการจัดซื้อ...</div>
        ) : procurements.length === 0 ? (
          <div className="procure-empty">
            <FaBoxes style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '10px' }} />
            <p>ยังไม่มีบันทึกการจัดซื้อวัตถุดิบ กดปุ่ม "บันทึกรับวัตถุดิบ" ด้านบนเพื่อเริ่มใช้งาน</p>
          </div>
        ) : (
          <table className="procure-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>วันที่ซื้อ</th>
                <th style={{ width: '10%' }}>เลขที่ใบเสร็จ</th>
                <th style={{ width: '18%' }}>วัตถุดิบ</th>
                <th style={{ width: '16%' }}>ผู้ขาย / ร้านค้า</th>
                <th style={{ width: '12%', textAlign: 'right' }}>จำนวนที่ซื้อ</th>
                <th style={{ width: '10%', textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ width: '12%', textAlign: 'right' }}>ราคารวม</th>
                <th style={{ width: '12%' }}>วันหมดอายุล็อต</th>
              </tr>
            </thead>
            <tbody>
              {procurements.map((item) => (
                <tr key={item.procurement_id}>
                  <td><strong>{item.purchase_date}</strong></td>
                  <td>
                    <span className="inv-badge">{item.invoice_number || '-'}</span>
                  </td>
                  <td>
                    <span className="ing-name">{item.ingredient_name}</span>
                  </td>
                  <td>
                    <span className="supplier-tag"><FaStore /> {item.supplier_name}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{Number(item.quantity).toLocaleString()}</strong> {item.unit}
                  </td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>
                    ฿{Number(item.unit_cost).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                    ฿{Number(item.total_cost).toLocaleString()}
                  </td>
                  <td>
                    {item.expiration_date ? (
                      <span className="exp-date">{item.expiration_date}</span>
                    ) : (
                      <span style={{ color: '#aaa', fontSize: '11px' }}>ไม่ระบุ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pop-up Modal บันทึกรับวัตถุดิบเข้าคลัง (Simple Receiving) */}
      {showModal && (
        <div className="procure-modal-overlay">
          <div className="procure-modal-box">
            <div className="procure-modal-header">
              <div>
                <h3>บันทึกรับวัตถุดิบเข้าสต็อก (Simple Receiving)</h3>
                <p className="modal-sub">ระบบจะเพิ่มล็อตเข้าคลัง (Inventory FIFO) และบันทึกประวัติต้นทุนอัตโนมัติ</p>
              </div>
              <button className="procure-close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>

            <form onSubmit={handleSaveProcurement}>
              <div className="form-group">
                <label>วัตถุดิบที่ต้องการรับเข้า *</label>
                <select
                  required
                  value={formData.ingredient_id}
                  onChange={(e) => setFormData({ ...formData, ingredient_id: e.target.value })}
                >
                  {ingredients.map(ing => (
                    <option key={ing.ingredient_id} value={ing.ingredient_id}>
                      {ing.ingredient_name} (หน่วย: {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ร้านค้า / ผู้จัดจำหน่าย (Supplier)</label>
                  <input 
                    type="text" 
                    placeholder="เช่น แม็คโคร, สหกรณ์โคนม, ซื้อสดตลาด"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>เลขที่ใบเสร็จ / ใบส่งของ</label>
                  <input 
                    type="text" 
                    placeholder="เช่น INV-2026-001"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>จำนวนที่ซื้อ ({getSelectedUnit()}) *</label>
                  <input 
                    type="number" 
                    required 
                    step="any"
                    min="0.01"
                    placeholder="เช่น 1000"
                    value={formData.quantity}
                    onChange={(e) => handleQtyOrCostChange('quantity', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ราคาต้นทุนต่อหน่วย (บาท) *</label>
                  <input 
                    type="number" 
                    required 
                    step="any"
                    min="0.01"
                    placeholder="เช่น 0.25"
                    value={formData.unit_cost}
                    onChange={(e) => handleQtyOrCostChange('unit_cost', e.target.value)}
                  />
                </div>
              </div>

              {/* สรุปราคารวมที่คำนวณให้อัตโนมัติ */}
              <div className="total-cost-preview">
                <span>ราคารวมที่จัดซื้อ:</span>
                <strong>฿{Number(formData.total_cost || 0).toLocaleString()}</strong>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันที่จัดซื้อ *</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันหมดอายุของล็อตนี้</label>
                  <input 
                    type="date" 
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>หมายเหตุ / รายละเอียดเพิ่มเติม</label>
                <input 
                  type="text" 
                  placeholder="เช่น ล็อตพิเศษ, ซื้อโปรโมชั่น"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="procure-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-save-procure">บันทึกรับวัตถุดิบเข้าสต็อก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

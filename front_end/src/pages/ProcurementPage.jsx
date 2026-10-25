import React, { useState, useEffect } from 'react';
import './ProcurementPage.css';
import { 
  FaBoxes, FaPlus, FaReceipt, FaMoneyBillWave, FaCalendarAlt, FaStore, FaTimes, FaFilter, FaEdit, FaTrash 
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function ProcurementPage() {
  const [procurements, setProcurements] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // เช็คว่ากำลังเพิ่มหรือแก้ไข
  const [editId, setEditId] = useState(null);

  const [selectedIngredient, setSelectedIngredient] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [formData, setFormData] = useState({
    ingredient_id: '', supplier_name: '', quantity: '', unit_cost: '', total_cost: '',
    purchase_date: new Date().toISOString().slice(0, 10), expiration_date: '', invoice_number: '', notes: ''
  });

  useEffect(() => {
    fetchProcurements();
    fetchIngredients();
    fetchSummary();
  }, [selectedIngredient]);

  const fetchProcurements = async () => {
    setLoading(true);
    try {
      let url = `/api/procurements?ingredient_id=${selectedIngredient}`;
      if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url);
      if (response.ok) setProcurements(await response.json());
    } catch (error) { console.error('Error fetching procurements:', error); } 
    finally { setLoading(false); }
  };

  const fetchIngredients = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/stock');
      if (response.ok) {
        const data = await response.json();
        setIngredients(data);
        if (data.length > 0 && !formData.ingredient_id) {
          setFormData(prev => ({ ...prev, ingredient_id: data[0].ingredient_id }));
        }
      }
    } catch (error) { console.error('Error fetching ingredients:', error); }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/procurements/summary');
      if (response.ok) setSummary(await response.json());
    } catch (error) { console.error('Error fetching summary:', error); }
  };

  const handleOpenModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({
      ingredient_id: ingredients[0]?.ingredient_id || '', supplier_name: '', quantity: '', unit_cost: '', total_cost: '',
      purchase_date: new Date().toISOString().slice(0, 10), expiration_date: '', invoice_number: '', notes: ''
    });
    setShowModal(true);
  };

  const handleEditClick = (item) => {
    setIsEditing(true);
    setEditId(item.procurement_id);
    setFormData({
      ingredient_id: item.ingredient_id,
      supplier_name: item.supplier_name || '',
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
      purchase_date: item.purchase_date, // รูปแบบต้องเป็น YYYY-MM-DD
      expiration_date: item.expiration_date || '',
      invoice_number: item.invoice_number || '',
      notes: item.notes || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = (item) => {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: `คุณต้องการลบใบบันทึกจัดซื้อของ ${item.ingredient_name} ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: 'ลบข้อมูล'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const response = await fetch(`/api/procurements/${item.procurement_id}`, { method: 'DELETE' });
          const data = await response.json();
          if (response.ok) {
            Swal.fire('ลบแล้ว!', '', 'success');
            fetchProcurements();
            fetchSummary();
          } else {
            Swal.fire('ผิดพลาด', data.message, 'warning');
          }
        } catch (error) { Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error'); }
      }
    });
  };

  const handleQtyOrCostChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    const q = parseFloat(field === 'quantity' ? value : formData.quantity) || 0;
    const u = parseFloat(field === 'unit_cost' ? value : formData.unit_cost) || 0;
    updated.total_cost = (q * u).toFixed(2);
    setFormData(updated);
  };

  const getSelectedUnit = () => {
    const found = ingredients.find(i => i.ingredient_id === formData.ingredient_id);
    return found ? found.unit : 'หน่วย';
  };

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

    const url = isEditing ? `/api/procurements/${editId}` : '/api/procurements';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, received_by: currentEmpId })
      });

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: isEditing ? 'อัปเดตข้อมูลเรียบร้อย' : 'สร้างรายการจัดซื้อเรียบร้อย โปรดไปที่คลังสต็อกเพื่อรับของเข้า',
          timer: 2500,
          showConfirmButton: false
        });
        setShowModal(false);
        fetchProcurements();
        fetchSummary();
      } else {
        const data = await response.json();
        Swal.fire('ผิดพลาด', data.message || 'บันทึกไม่สำเร็จ', 'error');
      }
    } catch (error) { Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error'); }
  };

  const totalSpent = summary?.overview?.total_spend || 0;
  const totalOrders = summary?.overview?.total_orders || 0;
  const avgSpend = summary?.overview?.avg_spend_per_purchase || 0;

  return (
    <div className="procure-page-container">
      <div className="procure-header">
        <div>
          <h2><FaBoxes /> จัดการซื้อวัตถุดิบ (Material Procurement)</h2>
          <p className="procure-subtitle">บันทึกบิลซื้อวัตถุดิบ คุมต้นทุนการซื้อ และรอยืนยันรับของเข้าคลัง</p>
        </div>
        <button className="btn-add-procure" onClick={handleOpenModal}>
          <FaPlus /> สร้างบันทึกจัดซื้อ
        </button>
      </div>

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

      <div className="procure-filter-bar">
        <div className="filter-group-inline">
          <label><FaFilter /> กรองตามวัตถุดิบ:</label>
          <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)} className="filter-select">
            <option value="ALL">-- วัตถุดิบทั้งหมด --</option>
            {ingredients.map(i => (
              <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name} ({i.unit})</option>
            ))}
          </select>
        </div>
        <div className="filter-group-inline">
          <label><FaCalendarAlt /> ตั้งแต่วันที่:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-date-input" />
          <span>ถึง</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-date-input" />
          <button className="btn-filter-apply" onClick={fetchProcurements}>กรอง</button>
          <button className="btn-filter-reset" onClick={() => { setStartDate(''); setEndDate(''); setSelectedIngredient('ALL'); }}>ล้าง</button>
        </div>
      </div>

      <div className="procure-table-card">
        {loading ? (
          <div className="procure-loading">กำลังโหลดประวัติการจัดซื้อ...</div>
        ) : procurements.length === 0 ? (
          <div className="procure-empty">
            <FaBoxes style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '10px' }} />
            <p>ยังไม่มีบันทึกการจัดซื้อวัตถุดิบ กดปุ่ม "สร้างบันทึกจัดซื้อ" ด้านบนเพื่อเริ่มใช้งาน</p>
          </div>
        ) : (
          <table className="procure-table">
            <thead>
              <tr>
                <th style={{ width: '9%' }}>วันที่ซื้อ</th>
                <th style={{ width: '9%' }}>เลขใบเสร็จ</th>
                <th style={{ width: '15%' }}>วัตถุดิบ</th>
                <th style={{ width: '14%' }}>ผู้ขาย/ร้านค้า</th>
                <th style={{ width: '9%', textAlign: 'right' }}>จำนวน</th>
                <th style={{ width: '9%', textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ width: '9%', textAlign: 'right' }}>ราคารวม</th>
                <th style={{ width: '9%', textAlign: 'center' }}>สถานะ</th>
                <th style={{ width: '10%' }}>วันหมดอายุ</th>
                <th style={{ width: '7%', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {procurements.map((item) => (
                <tr key={item.procurement_id}>
                  <td><strong>{item.purchase_date}</strong></td>
                  <td><span className="inv-badge">{item.invoice_number || '-'}</span></td>
                  <td><span className="ing-name">{item.ingredient_name}</span></td>
                  <td><span className="supplier-tag"><FaStore /> {item.supplier_name}</span></td>
                  <td style={{ textAlign: 'right' }}><strong>{Number(item.quantity).toLocaleString()}</strong> {item.unit}</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>฿{Number(item.unit_cost).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>฿{Number(item.total_cost).toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    {item.status === 'รับเข้าแล้ว' ? (
                      <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>รับเข้าแล้ว</span>
                    ) : (
                      <span style={{ backgroundColor: '#fef08a', color: '#ca8a04', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>รอรับของ</span>
                    )}
                  </td>
                  <td>
                    {item.expiration_date ? <span className="exp-date">{item.expiration_date}</span> : <span style={{ color: '#aaa', fontSize: '11px' }}>ไม่ระบุ</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {/* ซ่อนปุ่มแก้ไข/ลบ ถ้ารับของเข้าสต็อกไปแล้ว */}
                    {item.status === 'รอรับของ' ? (
                      <div className="prod-action-buttons" style={{ justifyContent: 'center' }}>
                        <button className="prod-btn-edit" onClick={() => handleEditClick(item)} title="แก้ไข"><FaEdit /></button>
                        <button className="prod-btn-delete" onClick={() => handleDeleteClick(item)} title="ลบ"><FaTrash /></button>
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '11px' }}>ล็อกข้อมูล</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="procure-modal-overlay">
          <div className="procure-modal-box">
            <div className="procure-modal-header">
              <div>
                <h3>{isEditing ? 'แก้ไขข้อมูลการจัดซื้อ' : 'สร้างบันทึกการจัดซื้อวัตถุดิบ'}</h3>
                <p className="modal-sub">
                  {isEditing ? 'อัปเดตข้อมูลรายละเอียดใบบิน' : 'ระบบจะตั้งสถานะเป็น "รอรับของ" จนกว่าจะยืนยันในคลังสต็อก'}
                </p>
              </div>
              <button className="procure-close-btn" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleSaveProcurement}>
              <div className="form-group">
                <label>วัตถุดิบที่ต้องการรับเข้า *</label>
                <select required value={formData.ingredient_id} onChange={(e) => setFormData({ ...formData, ingredient_id: e.target.value })}>
                  {ingredients.map(ing => (
                    <option key={ing.ingredient_id} value={ing.ingredient_id}>{ing.ingredient_name} (หน่วย: {ing.unit})</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ร้านค้า / ผู้จัดจำหน่าย (Supplier)</label>
                  <input type="text" placeholder="เช่น แม็คโคร, สหกรณ์โคนม" value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>เลขที่ใบเสร็จ / ใบส่งของ</label>
                  <input type="text" placeholder="เช่น INV-2026-001" value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>จำนวนที่ซื้อ ({getSelectedUnit()}) *</label>
                  <input type="number" required step="any" min="0.01" value={formData.quantity} onChange={(e) => handleQtyOrCostChange('quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ราคาต้นทุนต่อหน่วย (บาท) *</label>
                  <input type="number" required step="any" min="0.01" value={formData.unit_cost} onChange={(e) => handleQtyOrCostChange('unit_cost', e.target.value)} />
                </div>
              </div>
              <div className="total-cost-preview">
                <span>ราคารวมที่จัดซื้อ:</span>
                <strong>฿{Number(formData.total_cost || 0).toLocaleString()}</strong>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันที่จัดซื้อ *</label>
                  <input type="date" required value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>วันหมดอายุของล็อตนี้</label>
                  <input type="date" value={formData.expiration_date} onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>หมายเหตุ / รายละเอียดเพิ่มเติม</label>
                <input type="text" placeholder="เช่น ล็อตพิเศษ, ซื้อโปรโมชั่น" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="procure-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-save-procure">{isEditing ? 'อัปเดตข้อมูล' : 'บันทึกการจัดซื้อ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import './POSPage.css';
import { 
  FaSearch, 
  FaTrash, 
  FaMoneyBillWave, 
  FaQrcode, 
  FaPrint, 
  FaTimes, 
  FaMotorcycle, 
  FaStore, 
  FaTag, 
  FaUser, 
  FaPhoneAlt, 
  FaMapMarkerAlt 
} from 'react-icons/fa';
import Swal from 'sweetalert2';

function POSPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [activePromotions, setActivePromotions] = useState([]); // โปรโมชั่นที่กำลังเปิดใช้งาน
  const [riders, setRiders] = useState([]); // รายชื่อไรเดอร์

  // โหมดคำสั่งซื้อ: 'takeaway' (หน้าร้าน) หรือ 'delivery' (จัดส่ง)
  const [orderType, setOrderType] = useState('takeaway');

  // ข้อมูลการจัดส่ง Delivery
  const [deliveryInfo, setDeliveryInfo] = useState({
    customer_name: '',
    customer_phone: '',
    delivery_address: '',
    delivery_fee: 20, // ค่าส่งเริ่มต้น 20 บาท
    rider_id: '',
    notes: ''
  });

  // State สำหรับระบบชำระเงิน
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('เงินสด'); // 'เงินสด' หรือ 'โอนเงิน'
  const [amountReceived, setAmountReceived] = useState('');
  
  // State สำหรับใบเสร็จ
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // ============================================================================
  // ดึงข้อมูลเริ่มต้นเมื่อเปิดหน้า POS: สินค้า, หมวดหมู่, โปรโมชั่นที่กำลังเปิดใช้งาน, และรายชื่อไรเดอร์
  // ============================================================================
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchActivePromotions();
    fetchRiders();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) setProducts(await response.json());
    } catch (error) { console.error('Error fetching products', error); }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) setCategories(await response.json());
    } catch (error) { console.error('Error fetching categories', error); }
  };

  // ----------------------------------------------------------------------------
  // ดึงโปรโมชั่นที่กำลังเปิดใช้งานอยู่ในปัจจุบัน (CURRENT_DATE อยู่ในช่วงเวลา)
  // เพื่อนำไปคำนวณส่วนลด % อัตโนมัติในตะกร้าสินค้า
  // ----------------------------------------------------------------------------
  const fetchActivePromotions = async () => {
    try {
      const response = await fetch('/api/promotions/active');
      if (response.ok) {
        const data = await response.json();
        setActivePromotions(data);
      }
    } catch (error) { console.error('Error fetching active promotions', error); }
  };

  // ----------------------------------------------------------------------------
  // ดึงรายชื่อไรเดอร์สำหรับเตรียมไว้ใน Dropdown หากลูกค้าเลือกสั่งแบบ Delivery
  // ----------------------------------------------------------------------------
  const fetchRiders = async () => {
    try {
      const response = await fetch('/api/deliveries/riders');
      if (response.ok) {
        const data = await response.json();
        setRiders(data);
        if (data.length > 0) {
          setDeliveryInfo(prev => ({ ...prev, rider_id: data[0].employee_id }));
        }
      }
    } catch (error) { console.error('Error fetching riders', error); }
  };

  const getImageUrl = (path) => {
    if (!path) return 'https://placehold.co/150x150?text=No+Image'; 
    if (path.includes('http')) return path; 
    return path.startsWith('/') ? path : `/${path}`;
  };

  // ----------------------------------------------------------------------------
  // Helper: ตรวจสอบว่าสินค้านี้มีโปรโมชั่นส่วนลดที่เปิดใช้งานอยู่หรือไม่
  // ----------------------------------------------------------------------------
  const getProductPromo = (productId) => {
    return activePromotions.find(p => p.product_id === productId);
  };

  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'All' || p.category_name === selectedCategory;
    const matchSearch = p.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch; 
  });

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: เพิ่มสินค้าลงตะกร้า พร้อมคำนวณส่วนลดโปรโมชั่นอัตโนมัติ
  // ----------------------------------------------------------------------------
  const addToCart = (product) => {
    const promo = getProductPromo(product.product_id);
    const originalPrice = Number(product.price);
    // คำนวณส่วนลดอัตโนมัติตาม %
    const discountPct = promo ? Number(promo.discount_percentage) : 0;
    const finalPrice = promo ? Math.round(originalPrice * (1 - discountPct / 100)) : originalPrice;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.product_id);
      const currentQty = existingItem ? existingItem.qty : 0;
      if (currentQty + 1 > product.max_qty) {
        Swal.fire('วัตถุดิบไม่พอ!', `"${product.product_name}" เหลือวัตถุดิบชงได้อีกแค่ ${product.max_qty} ที่ครับ`, 'warning');
        return prevCart;
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

  const updateQuantity = (productId, amount) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.qty + amount;
        if (amount > 0 && newQty > item.max_qty) {
          Swal.fire('วัตถุดิบไม่พอ!', `ชงได้สูงสุดแค่ ${item.max_qty} ที่ครับ`, 'warning');
          return item;
        }
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  const clearCart = () => setCart([]);

  // คำนวณยอดเงิน
  const itemsSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const currentDeliveryFee = orderType === 'delivery' ? Number(deliveryInfo.delivery_fee || 0) : 0;
  const total = itemsSubtotal + currentDeliveryFee;
  const changeAmount = paymentMethod === 'เงินสด' && amountReceived ? Math.max(0, parseInt(amountReceived) - total) : 0;

  // ฟังก์ชันเปิดหน้าต่างจ่ายเงิน
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    
    // ตรวจสอบข้อมูล Delivery
    if (orderType === 'delivery') {
      if (!deliveryInfo.customer_name.trim()) {
        return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อลูกค้าสำหรับจัดส่ง', 'warning');
      }
      if (!deliveryInfo.customer_phone.trim()) {
        return Swal.fire('แจ้งเตือน', 'กรุณาระบุเบอร์โทรลูกค้าสำหรับจัดส่ง', 'warning');
      }
      if (!deliveryInfo.delivery_address.trim()) {
        return Swal.fire('แจ้งเตือน', 'กรุณาระบุที่อยู่จัดส่ง', 'warning');
      }
    }

    if (orderType === 'delivery') {
      setPaymentMethod('เก็บเงินปลายทาง');
    } else {
      setPaymentMethod('เงินสด');
    }
    setAmountReceived(total); // ค่าเริ่มต้นรับเงินพอดี
    setShowPaymentModal(true);
  };

  // ฟังก์ชันยืนยันการชำระเงินเข้า Database
  const confirmPayment = async () => {
    const isCod = (orderType === 'delivery' && paymentMethod === 'เก็บเงินปลายทาง');

    // ถ้าเป็นเงินสดหน้าร้าน ต้องเช็คว่ากรอกเงินรับมาครบถ้วน
    if (paymentMethod === 'เงินสด') {
      const received = parseInt(amountReceived);
      if (!amountReceived || isNaN(received) || received <= 0) {
        return Swal.fire('แจ้งเตือน', 'กรุณากรอกจำนวนเงินรับให้ถูกต้องครับ', 'warning');
      }
      if (received < total) {
        const missingAmount = total - received;
        return Swal.fire('แจ้งเตือน', `รับเงินมาไม่ครบครับ (ขาดอีก ฿${missingAmount.toLocaleString()})`, 'warning');
      }
    }

    const finalTotal = Math.round(total);
    const loggedInUserStr = sessionStorage.getItem('user');
    let currentEmployeeId = 'E01'; 
    let currentEmployeeName = 'พนักงาน';

    if (loggedInUserStr) {
      try {
        const userObj = JSON.parse(loggedInUserStr);
        currentEmployeeId = userObj.employee_id || userObj.id || 'E01'; 
        currentEmployeeName = userObj.name || userObj.first_name || 'พนักงาน';
      } catch (e) { console.error("Error parsing user data:", e); }
    }

    try {
      Swal.fire({ 
        title: isCod ? 'กำลังยืนยันคำสั่งซื้อรายการ...' : 'กำลังประมวลผล...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
      });

      // ------------------------------------------------------------------------
      // ยิง API บันทึกการขาย (POST /api/sales):
      // - ส่งตะกร้าสินค้า cart พร้อมราคาที่คำนวณส่วนลด % รายเมนูแล้ว
      // - ส่งประเภทออเดอร์ (order_type): 'takeaway' หรือ 'delivery'
      // - กรณี 'เก็บเงินปลายทาง': ระบบจะบันทึกสถานะเป็น PENDING_PAYMENT (ยังไม่บันทึกยอดขายจริงจนกว่าไรเดอร์ส่งและรับเงิน)
      // ------------------------------------------------------------------------
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cart: cart, 
          total_amount: finalTotal, 
          employee_id: currentEmployeeId,
          payment_method: paymentMethod,
          amount_received: isCod ? 0 : (paymentMethod === 'เงินสด' ? parseInt(amountReceived) : finalTotal),
          change_amount: isCod ? 0 : changeAmount,
          order_type: orderType,
          delivery_fee: currentDeliveryFee,
          delivery_info: orderType === 'delivery' ? deliveryInfo : null
        })
      });
      const data = await response.json(); 

      if (response.ok) {
        Swal.close();
        setShowPaymentModal(false);

        if (isCod) {
          Swal.fire({
            icon: 'success',
            title: 'ยืนยันคำสั่งซื้อสำเร็จ!',
            text: 'ส่งงานไปยังหน้าจอไรเดอร์แล้ว (ระบบจะบันทึกยอดขายจริงเมื่อไรเดอร์จัดส่งและเก็บเงินแล้ว)',
            timer: 2500,
            showConfirmButton: false
          });
        }

        // เตรียมข้อมูลใบเสร็จ
        setCompletedOrder({
          order_id: data.order_id,
          date: new Date(data.created_at || Date.now()).toLocaleString('th-TH'),
          items: [...cart],
          itemsSubtotal: itemsSubtotal,
          deliveryFee: currentDeliveryFee,
          orderType: orderType,
          deliveryInfo: orderType === 'delivery' ? { ...deliveryInfo } : null,
          total: finalTotal,
          payment_method: paymentMethod,
          payment_status: data.payment_status || (isCod ? 'PENDING' : 'PAID'),
          amount_received: isCod ? 0 : (paymentMethod === 'เงินสด' ? parseInt(amountReceived) : finalTotal),
          change_amount: isCod ? 0 : changeAmount,
          cashier: currentEmployeeName
        });
        setCart([]); 
        fetchProducts(); 
        setShowReceiptModal(true); // เปิดหน้าต่างใบเสร็จ
      } else {
        Swal.fire('ผิดพลาด', data.message || 'ไม่สามารถบันทึกออเดอร์ได้', 'error');
      }
    } catch (error) {
      Swal.fire('ผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pos-container">
      {/* ฝั่งซ้าย: สินค้า */}
      <div className="pos-main">
        <div className="pos-header">
          <div>
            <h2>ระบบขายหน้าร้าน (POS)</h2>
            <div className="order-type-switch">
              <button 
                type="button"
                className={`order-type-btn ${orderType === 'takeaway' ? 'active' : ''}`}
                onClick={() => {
                  setOrderType('takeaway');
                  if (paymentMethod === 'เก็บเงินปลายทาง') setPaymentMethod('เงินสด');
                }}
              >
                <FaStore /> หน้าร้าน / กลับบ้าน
              </button>
              <button 
                type="button"
                className={`order-type-btn btn-delivery-type ${orderType === 'delivery' ? 'active' : ''}`}
                onClick={() => {
                  setOrderType('delivery');
                  setPaymentMethod('เก็บเงินปลายทาง');
                }}
              >
                <FaMotorcycle /> จัดส่งเดลิเวอรี่ (Delivery)
              </button>
            </div>
          </div>

          <div className="pos-search">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="ค้นหาสินค้า..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* แสดงแถบกรอกข้อมูล Delivery เมื่อเลือกโหมดจัดส่ง */}
        {orderType === 'delivery' && (
          <div className="pos-delivery-banner">
            <div className="delivery-banner-header">
              <span className="banner-title"><FaMotorcycle /> ข้อมูลการจัดส่งสินค้า (Delivery Details)</span>
              <span className="fee-badge">ค่าจัดส่ง: ฿{deliveryInfo.delivery_fee}</span>
            </div>
            <div className="delivery-fields-grid">
              <div className="delivery-input-group">
                <label><FaUser /> ชื่อลูกค้า:</label>
                <input 
                  type="text" 
                  placeholder="เช่น คุณสมชาย" 
                  value={deliveryInfo.customer_name}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, customer_name: e.target.value })}
                />
              </div>
              <div className="delivery-input-group">
                <label><FaPhoneAlt /> เบอร์โทรศัพท์:</label>
                <input 
                  type="text" 
                  placeholder="เช่น 0812345678" 
                  value={deliveryInfo.customer_phone}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, customer_phone: e.target.value })}
                />
              </div>
              <div className="delivery-input-group">
                <label><FaMapMarkerAlt /> ที่อยู่จัดส่ง:</label>
                <input 
                  type="text" 
                  placeholder="บ้านเลขที่ ซอย ถนน จุดสังเกต" 
                  value={deliveryInfo.delivery_address}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_address: e.target.value })}
                />
              </div>
              <div className="delivery-input-group" style={{ maxWidth: '140px' }}>
                <label>ค่าส่ง (บาท):</label>
                <input 
                  type="number" 
                  value={deliveryInfo.delivery_fee}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_fee: Number(e.target.value) })}
                />
              </div>
              <div className="delivery-input-group">
                <label>พนักงานส่งของ (Rider):</label>
                <select 
                  value={deliveryInfo.rider_id}
                  onChange={(e) => setDeliveryInfo({ ...deliveryInfo, rider_id: e.target.value })}
                >
                  <option value="">-- เลือกไรเดอร์ --</option>
                  {riders.map(r => (
                    <option key={r.employee_id} value={r.employee_id}>
                      {r.first_name} {r.last_name} ({r.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="pos-categories">
          <button className={`cat-btn ${selectedCategory === 'All' ? 'active' : ''}`} onClick={() => setSelectedCategory('All')}>ทั้งหมด</button>
          {categories.map(cat => (
            <button key={cat.category_id} className={`cat-btn ${selectedCategory === cat.category_name ? 'active' : ''}`} onClick={() => setSelectedCategory(cat.category_name)}>{cat.category_name}</button>
          ))}
        </div>

        <div className="pos-product-grid">
          {filteredProducts.map(product => {
            const isReadyToSell = product.max_qty > 0;
            const promo = getProductPromo(product.product_id);
            const originalPrice = Number(product.price);
            const discountedPrice = promo ? Math.round(originalPrice * (1 - Number(promo.discount_percentage) / 100)) : originalPrice;

            return (
              <div 
                key={product.product_id} 
                className={`pos-product-card ${!isReadyToSell ? 'sold-out' : ''} ${promo ? 'has-promo' : ''}`} 
                onClick={() => { if (!isReadyToSell) { Swal.fire('ขออภัย', 'สินค้าหมด', 'warning'); } else { addToCart(product); } }}
              >
                {/* ป้ายแสดงโปรโมชั่นอัตโนมัติ */}
                {promo && (
                  <div className="promo-badge-tag" title={promo.promotion_name}>
                    <FaTag /> ลด {promo.discount_percentage}%
                  </div>
                )}

                <img 
                  src={getImageUrl(product.image_url || product.image)} 
                  alt={product.product_name} 
                  className="pos-product-img" 
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150?text=Error'; }} 
                />
                <div className="pos-product-name">{product.product_name}</div>
                
                {/* แสดงราคาปกติ หรือ ราคาลดโปรโมชั่น */}
                <div className="pos-product-price">
                  {promo ? (
                    <div className="promo-price-box">
                      <span className="price-original">฿{originalPrice.toLocaleString()}</span>
                      <span className="price-discounted">฿{discountedPrice.toLocaleString()}</span>
                    </div>
                  ) : (
                    <span>฿{originalPrice.toLocaleString()}</span>
                  )}
                </div>

                {!isReadyToSell && <div className="sold-out-overlay">สินค้าหมด</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ฝั่งขวา: ตะกร้าสินค้า */}
      <div className="pos-sidebar">
        <div className="cart-header">
          <h3>🛒 ออเดอร์ปัจจุบัน</h3>
          {orderType === 'delivery' && <span className="cart-delivery-tag"><FaMotorcycle /> เดลิเวอรี่</span>}
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: '50px' }}>ยังไม่มีสินค้าในตะกร้า</div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product_name}</div>
                  <div className="cart-item-price">
                    {item.discount_percentage > 0 ? (
                      <span>
                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '11px', marginRight: '4px' }}>
                          ฿{item.original_price}
                        </span>
                        ฿{item.price} / ชิ้น <span className="item-promo-label">(-{item.discount_percentage}%)</span>
                      </span>
                    ) : (
                      <span>฿{item.price} / ชิ้น</span>
                    )}
                  </div>
                </div>
                <div className="cart-item-actions">
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, -1)}>-</button>
                  <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.product_id, 1)}>+</button>
                  <div className="cart-item-total">฿{(item.price * item.qty).toLocaleString()}</div>
                  <button style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', marginLeft: '5px' }} onClick={() => removeFromCart(item.product_id)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-row">
            <span>จำนวนสินค้า</span>
            <span>{cart.reduce((sum, item) => sum + item.qty, 0)} ชิ้น</span>
          </div>

          {orderType === 'delivery' && (
            <div className="summary-row" style={{ color: '#0284c7', fontWeight: '600' }}>
              <span>ค่าจัดส่ง (Delivery Fee)</span>
              <span>+฿{currentDeliveryFee.toLocaleString()}</span>
            </div>
          )}

          <div className="summary-total">
            <span>ยอดสุทธิ</span>
            <span>฿{total.toLocaleString()}</span>
          </div>

          <button className="btn-checkout" onClick={handleOpenPayment} disabled={cart.length === 0}>
            {orderType === 'delivery' ? 'ยืนยันคำสั่งซื้อรายการ' : 'ชำระเงิน'} ฿{total.toLocaleString()}
          </button>
          <button className="btn-clear" onClick={clearCart} disabled={cart.length === 0}>ยกเลิกออเดอร์</button>
        </div>
      </div>

      {/* Modal การยืนยันคำสั่งซื้อ / ชำระเงิน */}
      {showPaymentModal && (
        <div className="prod-modal-overlay no-print">
          {orderType === 'delivery' ? (
            /* ================= MODAL ยืนยันคำสั่งซื้อเดลิเวอรี่ (ส่งงานให้ไรเดอร์) ================= */
            <div className="prod-modal-box" style={{ maxWidth: '480px' }}>
              <div className="prod-modal-header" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    <FaMotorcycle />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>ยืนยันคำสั่งซื้อเดลิเวอรี่</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>ตรวจสอบข้อมูลก่อนส่งงานให้ไรเดอร์จัดส่ง</span>
                  </div>
                </div>
                <button className="prod-close-btn" onClick={() => setShowPaymentModal(false)}><FaTimes /></button>
              </div>

              {/* ข้อมูลการจัดส่ง */}
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', margin: '15px 0', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                  🛵 ข้อมูลผู้รับสินค้า
                </div>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                  <div><strong>ลูกค้า:</strong> {deliveryInfo.customer_name} ({deliveryInfo.customer_phone})</div>
                  <div><strong>ที่อยู่จัดส่ง:</strong> {deliveryInfo.delivery_address}</div>
                  {deliveryInfo.notes && <div><strong>หมายเหตุ:</strong> {deliveryInfo.notes}</div>}
                </div>
              </div>

              {/* เลือกวิธีชำระเงิน */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>
                  รูปแบบการชำระเงิน:
                </label>
                <div className="payment-methods" style={{ marginBottom: '10px' }}>
                  <button 
                    type="button"
                    className={`pay-btn ${paymentMethod === 'เก็บเงินปลายทาง' ? 'active' : ''}`} 
                    onClick={() => setPaymentMethod('เก็บเงินปลายทาง')}
                    style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                  >
                    <FaMotorcycle /> เก็บเงินปลายทาง
                  </button>
                  <button 
                    type="button"
                    className={`pay-btn ${paymentMethod === 'โอนเงิน' ? 'active' : ''}`} 
                    onClick={() => setPaymentMethod('โอนเงิน')}
                    style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                  >
                    <FaQrcode /> โอนเงิน (QR)
                  </button>
                </div>
              </div>

              {/* กล่องสรุปตามวิธีชำระ */}
              {paymentMethod === 'เก็บเงินปลายทาง' ? (
                <div className="cod-info-card" style={{ marginBottom: '18px' }}>
                  <div className="cod-icon-title">
                    <FaMotorcycle /> <strong>เก็บเงินปลายทาง (COD)</strong>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#166534' }}>
                    ไรเดอร์จะเป็นผู้เรียกเก็บเงิน (เงินสด หรือ สแกนโอน) เมื่อไปส่งถึงลูกค้า
                  </p>
                  <div className="cod-amount-row">
                    <span>ยอดที่ไรเดอร์ต้องเก็บ:</span>
                    <span className="cod-total-highlight">฿{total.toLocaleString()}</span>
                  </div>
                  <small className="cod-note-text" style={{ color: '#047857' }}>
                    * ระบบจะยังไม่บันทึกยอดขายจริง จนกว่าไรเดอร์จะไปส่งถึงและกดยืนยันยอดเงิน (เงินสด/โอน)
                  </small>
                </div>
              ) : (
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '18px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    <span>ยอดชำระล่วงหน้า:</span>
                    <span style={{ color: '#e74c3c' }}>฿{total.toLocaleString()}</span>
                  </div>
                  <div className="qr-container" style={{ padding: '10px', background: 'white', borderRadius: '8px' }}>
                    <img src="https://promptpay.io/0812345678.png" alt="QR Code" style={{ width: '130px', height: '130px' }} />
                    <p style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>ลูกค้าสแกนโอนเข้าบัญชีร้าน ฿{total.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* ปุ่มยืนยันคำสั่งซื้อเดลิเวอรี่ */}
              <button 
                className="btn-checkout" 
                style={{ width: '100%', fontSize: '17px', padding: '14px', background: '#0284c7' }} 
                onClick={confirmPayment}
              >
                {paymentMethod === 'เก็บเงินปลายทาง' 
                  ? '🚀 ยืนยันคำสั่งซื้อ (ส่งงานให้ไรเดอร์)' 
                  : '✅ ยืนยันการรับเงินโอน (ส่งงานให้ไรเดอร์)'}
              </button>
            </div>
          ) : (
            /* ================= MODAL ชำระเงินหน้าร้าน / กลับบ้าน (Takeaway) ================= */
            <div className="prod-modal-box" style={{ maxWidth: '420px' }}>
              <div className="prod-modal-header">
                <h3>เลือกช่องทางการชำระเงิน</h3>
                <button className="prod-close-btn" onClick={() => setShowPaymentModal(false)}><FaTimes /></button>
              </div>
              
              <div className="payment-methods">
                <button className={`pay-btn ${paymentMethod === 'เงินสด' ? 'active' : ''}`} onClick={() => setPaymentMethod('เงินสด')}>
                  <FaMoneyBillWave /> เงินสด
                </button>
                <button className={`pay-btn ${paymentMethod === 'โอนเงิน' ? 'active' : ''}`} onClick={() => setPaymentMethod('โอนเงิน')}>
                  <FaQrcode /> โอนเงิน (QR)
                </button>
              </div>

              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                  <span>ยอดที่ต้องชำระ:</span>
                  <span style={{ color: '#e74c3c' }}>฿{total.toLocaleString()}</span>
                </div>

                {paymentMethod === 'เงินสด' ? (
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>รับเงินมา (บาท)</label>
                    <input 
                      type="number" 
                      className="prod-form-group-input" 
                      value={amountReceived} 
                      onChange={(e) => setAmountReceived(e.target.value)} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', marginTop: '15px', color: changeAmount > 0 ? '#2ecc71' : '#555' }}>
                      <span>เงินทอน:</span>
                      <span style={{ fontWeight: 'bold' }}>฿{changeAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="qr-container">
                    <img src="https://promptpay.io/0812345678.png" alt="QR Code" style={{ width: '150px', height: '150px' }} />
                    <p style={{ marginTop: '10px', color: '#555' }}>สแกนเพื่อจ่าย ฿{total.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <button className="btn-checkout" style={{ width: '100%', fontSize: '18px', padding: '15px' }} onClick={confirmPayment}>
                ยืนยันการรับเงิน
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal ใบเสร็จ (พิมพ์ได้) */}
      {showReceiptModal && completedOrder && (
        <div className="prod-modal-overlay">
          <div className="prod-modal-box" style={{ maxWidth: '350px', background: 'transparent', boxShadow: 'none' }}>
            <div className="receipt-paper">
              <div className="receipt-header">
                <h3 style={{ margin: 0 }}>POS CAFE</h3>
                <p style={{ margin: '5px 0', fontSize: '12px' }}>
                  {completedOrder.orderType === 'delivery' ? '🛵 ใบเสร็จรับเงิน (เดลิเวอรี่)' : 'ใบเสร็จรับเงิน / ย่อ'}
                </p>
                <div style={{ fontSize: '12px', textAlign: 'left', marginTop: '10px' }}>
                  <div>เลขที่บิล: #{completedOrder.order_id}</div>
                  <div>วันที่: {completedOrder.date}</div>
                  <div>แคชเชียร์: {completedOrder.cashier}</div>
                  {completedOrder.orderType === 'delivery' && completedOrder.deliveryInfo && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #666' }}>
                      <div><strong>ลูกค้า:</strong> {completedOrder.deliveryInfo.customer_name}</div>
                      <div><strong>โทร:</strong> {completedOrder.deliveryInfo.customer_phone}</div>
                      <div><strong>ที่อยู่:</strong> {completedOrder.deliveryInfo.delivery_address}</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #333', paddingBottom: '10px', marginBottom: '10px' }}>
                {completedOrder.items.map((item, idx) => (
                  <div key={idx} className="receipt-item">
                    <span>
                      {item.qty}x {item.product_name}
                      {item.discount_percentage > 0 && <small style={{ color: '#e74c3c' }}> (-{item.discount_percentage}%)</small>}
                    </span>
                    <span>฿{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}

                {completedOrder.orderType === 'delivery' && (
                  <div className="receipt-item" style={{ marginTop: '6px', color: '#0284c7' }}>
                    <span>ค่าจัดส่ง (Delivery Fee)</span>
                    <span>฿{completedOrder.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="receipt-item receipt-total"><span>ยอดรวมทั้งสิ้น</span><span>฿{completedOrder.total.toLocaleString()}</span></div>
              <div className="receipt-item" style={{ marginTop: '10px' }}>
                <span>ชำระโดย</span>
                <span>{completedOrder.payment_method}</span>
              </div>
              {completedOrder.payment_method === 'เก็บเงินปลายทาง' ? (
                <div className="receipt-item" style={{ color: '#b45309', fontWeight: 'bold' }}>
                  <span>สถานะ</span>
                  <span>รอชำระเงินปลายทาง</span>
                </div>
              ) : (
                <>
                  <div className="receipt-item"><span>รับเงิน</span><span>฿{completedOrder.amount_received.toLocaleString()}</span></div>
                  <div className="receipt-item"><span>เงินทอน</span><span>฿{completedOrder.change_amount.toLocaleString()}</span></div>
                </>
              )}

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
                <p>ขอบคุณที่ใช้บริการครับ/ค่ะ</p>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="prod-btn-confirm" style={{ flex: 1, backgroundColor: '#34495e' }} onClick={handlePrint}><FaPrint /> พิมพ์ใบเสร็จ</button>
              <button className="prod-btn-cancel" style={{ flex: 1 }} onClick={() => setShowReceiptModal(false)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POSPage;

// ==============================================================================
// ไฟล์: front_end/src/pages/ReportsPage.jsx
// ระบบ: แดชบอร์ดรายงานยอดขายและวิเคราะห์ธุรกิจ (Sales Reporting & Data Analytics UI)
// วัตถุประสงค์:
//   - แสดงภาพรวมผลลัพธ์ทางธุรกิจ (KPIs): Gross Sales, Total Orders, Average Order Value (AOV)
//   - 📋 วันนี้ขายอะไรได้บ้าง (Today's Sold Items): ดูรายการเมนูที่ขายออก จำนวนแก้ว ยอดขายรวม
//   - 🧾 ประวัติบิลคำสั่งซื้อ (Orders History): แสดงวัน-เวลาที่ขายออกอย่างละเอียด และเปิดดูรายการในบิล
//   - กราฟยอดขายรายชั่วโมง (Hourly Peak Hours) เพื่อใช้วางแผนจัดตารางงานพนักงาน
//   - อันดับสินค้าขายดี (Top 10) และสัดส่วนการชำระเงิน (Cash vs Transfer)
//   - การวิเคราะห์เชิงลึก (Business Analytics):
//     1. Market Basket Analysis (สินค้าที่ลูกค้ามักสั่งคู่กันบ่อย)
//     2. ABC Pareto Analysis (เกรดสินค้าตามสัดส่วนยอดขาย 80/20)
//   - ฟังก์ชันส่งออกไฟล์ CSV สำหรับนำไปต่อยอดใน Power BI / Excel / Python Pandas
// ==============================================================================

import React, { useState, useEffect } from "react";
import "./ReportPage.css";
import {
  FaChartBar,
  FaCalendarAlt,
  FaDownload,
  FaSyncAlt,
  FaMoneyBillWave,
  FaReceipt,
  FaShoppingBag,
  FaUsers,
  FaClock,
  FaTags,
  FaLightbulb,
  FaBoxOpen,
  FaExchangeAlt,
  FaSearch,
  FaEye,
  FaPrint,
  FaTimes,
  FaMotorcycle,
  FaUtensils,
  FaCoffee,
  FaListAlt
} from "react-icons/fa";
import Swal from "sweetalert2";

export default function ReportsPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - activeTab: แท็บที่เลือก
  //     'overview'    -> ภาพรวมผลลัพธ์การขาย (Sales Overview)
  //     'today_items' -> วันนี้ขายอะไรได้บ้าง (Today's Sold Items)
  //     'orders'      -> ประวัติบิลคำสั่งซื้อ & ดูรายการในบิล (Orders History)
  //     'analytics'   -> การวิเคราะห์ข้อมูลธุรกิจ (Market Basket & ABC Pareto)
  // - dateRange: ตัวเลือกช่วงเวลา ('today', '7days', '30days', 'all', 'custom')
  // - startDate, endDate: วันที่เริ่มต้น-สิ้นสุดเมื่อเลือก 'custom'
  // ----------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("overview"); 
  const [dateRange, setDateRange] = useState("all"); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  // ข้อมูลจาก API หลัก
  const [summaryData, setSummaryData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // ข้อมูลสำหรับแท็บ "วันนี้ขายอะไรได้บ้าง"
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todayItemsData, setTodayItemsData] = useState({ summary: {}, items: [] });
  const [todayItemsSearch, setTodayItemsSearch] = useState("");
  const [todayLoading, setTodayLoading] = useState(false);

  // ข้อมูลสำหรับแท็บ "ประวัติบิลคำสั่งซื้อ"
  const [ordersList, setOrdersList] = useState([]);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Modal แสดงรายละเอียดของบิลที่เลือก
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);

  // ดึงข้อมูลเมื่อเปลี่ยนช่วงเวลา หรือเปลี่ยนแท็บ
  useEffect(() => {
    if (activeTab === "overview") {
      fetchReportSummary();
      fetchAnalytics();
    } else if (activeTab === "today_items") {
      fetchTodayItems(todayDate);
    } else if (activeTab === "orders") {
      fetchOrdersList();
    } else if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [dateRange, activeTab]);

  // ----------------------------------------------------------------------------
  // 1. ฟังก์ชัน: ดึงข้อมูลสรุปยอดขายตามช่วงเวลาที่เลือก (Overview Summary)
  // ----------------------------------------------------------------------------
  const fetchReportSummary = async () => {
    setLoading(true);
    try {
      let url = `/api/reports/summary?range=${dateRange}`;
      if (dateRange === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSummaryData(data);
      } else {
        console.error("Failed to fetch summary");
      }
    } catch (error) {
      console.error("Error fetching report summary:", error);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 2. ฟังก์ชัน: ดึงข้อมูลสินค้าที่ขายออกไปในวันนี้ (Today's Items Sold)
  // ----------------------------------------------------------------------------
  const fetchTodayItems = async (date) => {
    setTodayLoading(true);
    try {
      const target = date || todayDate;
      const response = await fetch(`/api/reports/today-items?date=${target}`);
      if (response.ok) {
        const data = await response.json();
        setTodayItemsData(data);
      }
    } catch (error) {
      console.error("Error fetching today items:", error);
    } finally {
      setTodayLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 3. ฟังก์ชัน: ดึงประวัติรายการคำสั่งซื้อ (Orders History)
  // ----------------------------------------------------------------------------
  const fetchOrdersList = async () => {
    setOrdersLoading(true);
    try {
      let url = `/api/reports/orders?range=${dateRange}`;
      if (dateRange === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (ordersSearch.trim()) {
        url += `&search=${encodeURIComponent(ordersSearch.trim())}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setOrdersList(data);
      }
    } catch (error) {
      console.error("Error fetching orders list:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 4. ฟังก์ชัน: ดึงข้อมูลการวิเคราะห์เชิงลึก (Market Basket & ABC Pareto)
  // ----------------------------------------------------------------------------
  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/reports/analytics");
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  // ----------------------------------------------------------------------------
  // 5. ฟังก์ชัน: กรองวันที่แบบระบุเอง (Custom Date Range)
  // ----------------------------------------------------------------------------
  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      Swal.fire("แจ้งเตือน", "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน", "warning");
      return;
    }
    setDateRange("custom");
    if (activeTab === "overview") fetchReportSummary();
    if (activeTab === "orders") fetchOrdersList();
  };

  // ----------------------------------------------------------------------------
  // 6. ฟังก์ชัน: ส่งออกไฟล์ CSV สำหรับนำไปต่อยอด Data Analysis ในโปรแกรมอื่น
  // ----------------------------------------------------------------------------
  const handleExportCSV = () => {
    let url = `/api/reports/export?range=${dateRange}`;
    if (dateRange === "custom" && startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }
    window.open(url, "_blank");
    Swal.fire({
      icon: "success",
      title: "กำลังดาวน์โหลดข้อมูล!",
      text: "ระบบได้ส่งออกข้อมูลเพื่อนำไปทำ Data Analysis ใน Excel / Power BI เรียบร้อยแล้ว",
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // ดึงค่าสรุป KPIs หรือกำหนดค่าเริ่มต้น
  const kpis = summaryData?.kpis || {
    totalOrders: 0,
    grossSales: 0,
    aov: 0,
    maxOrderAmount: 0,
  };

  const topProducts = summaryData?.topProducts || [];
  const paymentMethods = summaryData?.paymentMethods || [];
  const hourlyTrends = summaryData?.hourlyTrends || [];
  const categorySales = summaryData?.categories || [];
  const employeeSales = summaryData?.employeeSales || [];
  const marketBasket = analyticsData?.marketBasket || [];
  const abcAnalysis = analyticsData?.abcAnalysis || [];

  // ชั่วโมงที่มียอดขายสูงสุด (Peak Hour)
  const peakHourItem = hourlyTrends.length > 0
    ? [...hourlyTrends].sort((a, b) => Number(b.total_sales) - Number(a.total_sales))[0]
    : null;

  const maxProductRevenue = topProducts.length > 0
    ? Math.max(...topProducts.map((p) => Number(p.total_revenue)))
    : 1;

  const maxHourlySales = hourlyTrends.length > 0
    ? Math.max(...hourlyTrends.map((h) => Number(h.total_sales)))
    : 1;

  // กรองรายการสินค้าที่ขายออกไปในวันนี้ตามคำค้นหา
  const filteredTodayItems = (todayItemsData.items || []).filter((item) => {
    if (!todayItemsSearch.trim()) return true;
    const term = todayItemsSearch.toLowerCase();
    return (
      (item.product_name && item.product_name.toLowerCase().includes(term)) ||
      (item.category_name && item.category_name.toLowerCase().includes(term)) ||
      (item.product_id && item.product_id.toString().includes(term))
    );
  });

  return (
    <div className="reports-container">
      {/* 1. Header & Filter Toolbar */}
      <div className="reports-header-section">
        <div className="header-titles">
          <h2>
            <FaChartBar className="icon-title" /> หน้ารายงานผลลัพธ์การขายและวิเคราะห์ธุรกิจ
          </h2>
          <p className="subtitle">
            รายงานตัวเลขการขาย ข้อมูลเชิงลึก ประวัติบิล และชุดข้อมูลสำหรับทำ Business Data Analysis
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-export-csv" onClick={handleExportCSV} title="ดาวน์โหลดไฟล์ CSV สำหรับทำ Data Analysis">
            <FaDownload /> Export ข้อมูล (CSV)
          </button>
          <button
            className="btn-refresh"
            onClick={() => {
              if (activeTab === "overview") fetchReportSummary();
              if (activeTab === "today_items") fetchTodayItems(todayDate);
              if (activeTab === "orders") fetchOrdersList();
              if (activeTab === "analytics") fetchAnalytics();
            }}
            title="รีเฟรชข้อมูล"
          >
            <FaSyncAlt /> รีเฟรช
          </button>
        </div>
      </div>

      {/* 2. สลับแท็บฟังก์ชันหลักของหน้ารายงาน */}
      <div className="report-tabs">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <FaChartBar /> 1. ภาพรวมยอดขาย (Sales Overview)
        </button>
        <button
          className={`tab-btn ${activeTab === "today_items" ? "active" : ""}`}
          onClick={() => setActiveTab("today_items")}
        >
          <FaListAlt /> 2. วันนี้ขายอะไรได้บ้าง (Today's Items)
        </button>
        <button
          className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          <FaReceipt /> 3. ประวัติบิลคำสั่งซื้อ (Orders History)
        </button>
        <button
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          <FaLightbulb /> 4. วิเคราะห์ข้อมูลธุรกิจ (Business Analytics)
        </button>
      </div>

      {/* ----------------------------------------------------------------------------
          แท็บ 1: ภาพรวมผลลัพธ์การขาย (Overview)
         ---------------------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <>
          {/* แถบเลือกช่วงเวลา (Date Filter Bar) */}
          <div className="reports-filter-card">
            <div className="filter-pill-group">
              <span className="filter-label">
                <FaCalendarAlt /> ช่วงเวลา:
              </span>
              {[
                { id: "all", label: "ทั้งหมด (All Time)" },
                { id: "today", label: "วันนี้" },
                { id: "7days", label: "7 วันล่าสุด" },
                { id: "30days", label: "30 วันล่าสุด" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`filter-pill ${dateRange === item.id ? "active" : ""}`}
                  onClick={() => setDateRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* ฟอร์มระบุวันที่แบบกำหนดเอง */}
            <form className="custom-date-form" onSubmit={handleApplyCustomDate}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-input"
              />
              <span className="date-sep">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-input"
              />
              <button type="submit" className="btn-apply-date">
                กรองวันที่
              </button>
            </form>
          </div>

          {/* การ์ดสรุปตัวชี้วัดหลัก (Executive KPI Cards) */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-sales">
              <div className="kpi-icon-box">
                <FaMoneyBillWave />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">ยอดขายรวม (Gross Sales)</span>
                <h3 className="kpi-value">฿{Number(kpis.grossSales).toLocaleString()}</h3>
                <span className="kpi-hint">รายได้รวมจากการขาย</span>
              </div>
            </div>

            <div className="kpi-card kpi-orders">
              <div className="kpi-icon-box">
                <FaReceipt />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">จำนวนบิลทั้งหมด (Total Orders)</span>
                <h3 className="kpi-value">{Number(kpis.totalOrders).toLocaleString()} บิล</h3>
                <span className="kpi-hint">คำสั่งซื้อที่คิดเงินสำเร็จ</span>
              </div>
            </div>

            <div className="kpi-card kpi-aov">
              <div className="kpi-icon-box">
                <FaShoppingBag />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">ยอดเฉลี่ยต่อบิล (AOV / Basket Size)</span>
                <h3 className="kpi-value">฿{Number(kpis.aov).toFixed(2)}</h3>
                <span className="kpi-hint">เฉลี่ยต่อคำสั่งซื้อ</span>
              </div>
            </div>

            <div className="kpi-card kpi-peak">
              <div className="kpi-icon-box">
                <FaClock />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">ช่วงเวลาพีค (Peak Hour)</span>
                <h3 className="kpi-value">
                  {peakHourItem ? `${peakHourItem.hour}:00 น.` : "N/A"}
                </h3>
                <span className="kpi-hint">
                  {peakHourItem ? `ขายได้ ฿${Number(peakHourItem.total_sales).toLocaleString()}` : "ไม่มีข้อมูล"}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-box">กำลังประมวลผลข้อมูลการขาย...</div>
          ) : (
            <div className="tab-overview-grid">
              {/* กราฟยอดขายรายชั่วโมง (Hourly Peak Hours Visualizer) */}
              <div className="report-card col-span-2">
                <div className="card-header">
                  <h4>
                    <FaClock className="header-icon" /> ยอดขายตามช่วงเวลาของวัน (Hourly Peak Hours)
                  </h4>
                  <span className="header-tag">สำหรับจัดตารางกะพนักงานและเตรียมวัตถุดิบ</span>
                </div>
                <div className="card-body">
                  <div className="hourly-chart-container">
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hourData = hourlyTrends.find((item) => Number(item.hour) === h);
                      const sales = hourData ? Number(hourData.total_sales) : 0;
                      const orders = hourData ? Number(hourData.order_count) : 0;
                      const heightPct = maxHourlySales > 0 ? (sales / maxHourlySales) * 100 : 0;
                      const isPeak = peakHourItem && Number(peakHourItem.hour) === h;

                      return (
                        <div key={h} className="hour-bar-col">
                          <div className="bar-wrapper" title={`${h}:00 น. | ยอด ฿${sales.toLocaleString()} (${orders} บิล)`}>
                            <div
                              className={`hour-bar ${isPeak ? "bar-peak" : ""}`}
                              style={{ height: `${Math.max(heightPct, 4)}%` }}
                            >
                              {sales > 0 && <span className="bar-tooltip">฿{sales}</span>}
                            </div>
                          </div>
                          <span className={`hour-label ${isPeak ? "hour-label-peak" : ""}`}>
                            {h}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot dot-normal"></span> ยอดขายทั่วไป</span>
                    <span className="legend-item"><span className="legend-dot dot-peak"></span> ช่วงเวลาที่ขายดีที่สุด (Peak)</span>
                  </div>
                </div>
              </div>

              {/* สินค้าขายดี 10 อันดับแรก */}
              <div className="report-card">
                <div className="card-header">
                  <h4>
                    <FaShoppingBag className="header-icon" /> 10 อันดับสินค้าขายดี (Top Best Sellers)
                  </h4>
                  <span className="header-tag">เรียงตามยอดเงินขาย</span>
                </div>
                <div className="card-body">
                  <div className="top-products-list">
                    {topProducts.length > 0 ? (
                      topProducts.map((prod, index) => {
                        const pct = (Number(prod.total_revenue) / maxProductRevenue) * 100;
                        return (
                          <div key={prod.product_id} className="product-rank-item">
                            <div className="rank-badge">{index + 1}</div>
                            <div className="product-rank-info">
                              <div className="product-rank-top">
                                <span className="prod-name">{prod.product_name}</span>
                                <span className="prod-revenue">฿{Number(prod.total_revenue).toLocaleString()}</span>
                              </div>
                              <div className="product-rank-bottom">
                                <span className="prod-category">{prod.category_name}</span>
                                <span className="prod-qty">{prod.total_qty} ชิ้น</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="no-data-msg">ไม่พบข้อมูลสินค้าในช่วงเวลานี้</p>
                    )}
                  </div>
                </div>
              </div>

              {/* สัดส่วนการชำระเงินและหมวดหมู่สินค้า */}
              <div className="report-card">
                <div className="card-header">
                  <h4>
                    <FaMoneyBillWave className="header-icon" /> สัดส่วนวิธีการชำระเงิน (Payment Breakdown)
                  </h4>
                  <span className="header-tag">สำหรับกระทบยอดบัญชี</span>
                </div>
                <div className="card-body">
                  <div className="payment-breakdown-list">
                    {paymentMethods.map((pm, idx) => (
                      <div key={idx} className="payment-method-row">
                        <div className="pm-details">
                          <span className="pm-name">{pm.payment_method}</span>
                          <span className="pm-orders">{pm.order_count} บิล ({pm.percentage}%)</span>
                        </div>
                        <span className="pm-amount">฿{Number(pm.total_amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="divider-line"></div>

                  <h5 className="sub-card-title">
                    <FaTags /> ยอดขายตามหมวดหมู่สินค้า
                  </h5>
                  <div className="category-list">
                    {categorySales.map((cat, idx) => (
                      <div key={idx} className="category-row">
                        <span className="cat-name">{cat.category_name}</span>
                        <span className="cat-qty">{cat.total_qty} ชิ้น</span>
                        <span className="cat-amount">฿{Number(cat.total_revenue).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* สรุปประสิทธิภาพพนักงานแคชเชียร์ */}
              <div className="report-card col-span-2">
                <div className="card-header">
                  <h4>
                    <FaUsers className="header-icon" /> ผลการขายแยกตามพนักงานแคชเชียร์ (Staff Performance)
                  </h4>
                </div>
                <div className="card-body">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>รหัสพนักงาน</th>
                        <th>ชื่อพนักงาน</th>
                        <th style={{ textAlign: "center" }}>จำนวนบิลที่เปิดขาย</th>
                        <th style={{ textAlign: "right" }}>ยอดขายรวมที่ทำได้</th>
                        <th style={{ textAlign: "right" }}>ยอดเฉลี่ยต่อบิล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeSales.map((emp) => {
                        const avg = emp.total_orders > 0 ? Number(emp.total_sales) / Number(emp.total_orders) : 0;
                        return (
                          <tr key={emp.employee_id}>
                            <td style={{ fontWeight: "bold" }}>{emp.employee_id}</td>
                            <td>{emp.employee_name}</td>
                            <td style={{ textAlign: "center" }}>{emp.total_orders} บิล</td>
                            <td style={{ textAlign: "right", fontWeight: "bold", color: "#059669" }}>
                              ฿{Number(emp.total_sales).toLocaleString()}
                            </td>
                            <td style={{ textAlign: "right", color: "#64748b" }}>
                              ฿{avg.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ----------------------------------------------------------------------------
          แท็บ 2: วันนี้ขายอะไรได้บ้าง (Today's Items Sold)
         ---------------------------------------------------------------------------- */}
      {activeTab === "today_items" && (
        <div className="tab-today-items-container">
          {/* แถบควบคุม: เลือกวันที่ & ค้นหาเมนู */}
          <div className="reports-filter-card">
            <div className="filter-pill-group">
              <span className="filter-label">
                <FaCalendarAlt /> วันที่ตรวจสอบ:
              </span>
              <input
                type="date"
                value={todayDate}
                onChange={(e) => {
                  setTodayDate(e.target.value);
                  fetchTodayItems(e.target.value);
                }}
                className="date-input"
              />
              <button
                className="filter-pill active"
                onClick={() => {
                  const now = new Date().toISOString().slice(0, 10);
                  setTodayDate(now);
                  fetchTodayItems(now);
                }}
              >
                ดูของวันนี้ (Today)
              </button>
            </div>

            {/* ช่องค้นหาเมนู */}
            <div className="search-box-wrapper">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อเมนู, หมวดหมู่ หรือรหัสสินค้า..."
                value={todayItemsSearch}
                onChange={(e) => setTodayItemsSearch(e.target.value)}
                className="table-search-input"
              />
            </div>
          </div>

          {/* การ์ดสรุปตัวเลขของวันที่เลือก */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-sales">
              <div className="kpi-icon-box">
                <FaMoneyBillWave />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">ยอดขายสินค้ารวม</span>
                <h3 className="kpi-value">
                  ฿{Number(todayItemsData.summary?.totalSalesAmount || 0).toLocaleString()}
                </h3>
                <span className="kpi-hint">ยอดรวมจากสินค้าทั้งหมดที่ขายได้</span>
              </div>
            </div>

            <div className="kpi-card kpi-orders">
              <div className="kpi-icon-box">
                <FaCoffee />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">จำนวนชิ้นที่ขายออกไป</span>
                <h3 className="kpi-value">
                  {Number(todayItemsData.summary?.totalQtySold || 0).toLocaleString()} แก้ว / ชิ้น
                </h3>
                <span className="kpi-hint">ปริมาณสินค้าที่ขายได้จริง</span>
              </div>
            </div>

            <div className="kpi-card kpi-aov">
              <div className="kpi-icon-box">
                <FaBoxOpen />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">จำนวนเมนูที่ขายได้</span>
                <h3 className="kpi-value">
                  {Number(todayItemsData.summary?.uniqueItemsCount || 0)} รายการ
                </h3>
                <span className="kpi-hint">ชนิดสินค้าที่มียอดสั่งซื้อ</span>
              </div>
            </div>
          </div>

          {/* ตารางแสดงรายละเอียดสินค้าที่ขายออกไป */}
          <div className="report-card">
            <div className="card-header">
              <h4>
                <FaListAlt className="header-icon" /> รายการสินค้าที่ขายออกไป (วันที่: {todayDate})
              </h4>
              <span className="header-tag">เรียงจากจำนวนชิ้นที่ขายได้มากที่สุด</span>
            </div>
            <div className="card-body">
              {todayLoading ? (
                <div className="loading-box">กำลังโหลดรายการสินค้า...</div>
              ) : filteredTodayItems.length > 0 ? (
                <table className="report-table today-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px", textAlign: "center" }}>อันดับ</th>
                      <th style={{ width: "90px" }}>รหัสเมนู</th>
                      <th>ชื่อเมนูสินค้า</th>
                      <th>หมวดหมู่</th>
                      <th style={{ textAlign: "right" }}>ราคาเฉลี่ย / แก้ว</th>
                      <th style={{ textAlign: "center" }}>จำนวนที่ขายได้</th>
                      <th style={{ textAlign: "right" }}>ยอดขายรวม</th>
                      <th style={{ width: "160px" }}>สัดส่วนยอดขาย</th>
                      <th style={{ textAlign: "center" }}>พบในบิล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTodayItems.map((item, index) => {
                      const totalDaySales = Number(todayItemsData.summary?.totalSalesAmount || 1);
                      const itemRev = Number(item.total_revenue || 0);
                      const sharePct = totalDaySales > 0 ? ((itemRev / totalDaySales) * 100).toFixed(1) : 0;

                      return (
                        <tr key={item.product_id}>
                          <td style={{ textAlign: "center" }}>
                            <span className={`rank-pill ${index < 3 ? 'rank-top3' : ''}`}>
                              {index + 1}
                            </span>
                          </td>
                          <td style={{ fontWeight: "600", color: "#64748b" }}>
                            #{item.product_id}
                          </td>
                          <td style={{ fontWeight: "700", color: "#0f172a" }}>
                            {item.product_name}
                          </td>
                          <td>
                            <span className="category-pill">{item.category_name}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            ฿{Number(item.avg_unit_price).toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="qty-sold-badge">
                              {item.total_qty} ชิ้น
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "bold", color: "#059669" }}>
                            ฿{Number(item.total_revenue).toLocaleString()}
                          </td>
                          <td>
                            <div className="table-share-cell">
                              <span className="share-text">{sharePct}%</span>
                              <div className="table-progress-bg">
                                <div className="table-progress-fill" style={{ width: `${Math.min(sharePct, 100)}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", color: "#475569" }}>
                            {item.order_count} บิล
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="no-data-msg">
                  {todayItemsSearch ? "ไม่พบสินค้าที่ตรงกับคำค้นหา" : "ยังไม่มีรายการสินค้าขายออกในวันที่เลือก"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------
          แท็บ 3: ประวัติบิลคำสั่งซื้อ (Orders History & ดูรายการในบิล)
         ---------------------------------------------------------------------------- */}
      {activeTab === "orders" && (
        <div className="tab-orders-container">
          {/* แถบควบคุม: เลือกช่วงเวลา & ค้นหาบิล */}
          <div className="reports-filter-card">
            <div className="filter-pill-group">
              <span className="filter-label">
                <FaCalendarAlt /> ช่วงเวลา:
              </span>
              {[
                { id: "today", label: "วันนี้" },
                { id: "7days", label: "7 วันล่าสุด" },
                { id: "30days", label: "30 วันล่าสุด" },
                { id: "all", label: "ทั้งหมด" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`filter-pill ${dateRange === item.id ? "active" : ""}`}
                  onClick={() => setDateRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* ช่องค้นหาบิล */}
            <div className="search-box-wrapper">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่บิล, ชื่อพนักงาน, ลูกค้า, หรือวิธีชำระ..."
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchOrdersList();
                }}
                className="table-search-input"
              />
              <button className="btn-search-apply" onClick={fetchOrdersList}>
                ค้นหา
              </button>
            </div>
          </div>

          {/* ตารางแสดงรายการคำสั่งซื้อทั้งหมด */}
          <div className="report-card">
            <div className="card-header">
              <h4>
                <FaReceipt className="header-icon" /> รายการบิลคำสั่งซื้อทั้งหมด ({ordersList.length} รายการ)
              </h4>
              <span className="header-tag">คลิก "ดูรายการในบิล" เพื่อดูรายละเอียดเมนูที่สั่ง</span>
            </div>
            <div className="card-body">
              {ordersLoading ? (
                <div className="loading-box">กำลังโหลดประวัติบิลคำสั่งซื้อ...</div>
              ) : ordersList.length > 0 ? (
                <table className="report-table orders-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>เลขที่บิล</th>
                      <th>วัน-เวลา ที่ขายออก</th>
                      <th>ประเภทออเดอร์</th>
                      <th>วิธีชำระเงิน</th>
                      <th>พนักงานแคชเชียร์</th>
                      <th style={{ textAlign: "center" }}>จำนวนรายการ</th>
                      <th style={{ textAlign: "right" }}>ยอดรวมสุทธิ</th>
                      <th style={{ textAlign: "center", width: "140px" }}>การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersList.map((order) => {
                      const totalItemsQty = (order.items || []).reduce((acc, curr) => acc + (curr.quantity || 1), 0);
                      const uniqueCount = (order.items || []).length;

                      return (
                        <tr key={order.order_id}>
                          <td style={{ fontWeight: "700", color: "#0284c7" }}>
                            #{order.order_id}
                          </td>
                          <td>
                            <div className="order-datetime-cell">
                              <span className="order-date-text">
                                <FaCalendarAlt className="mini-icon" /> {order.sale_date_th}
                              </span>
                              <span className="order-time-text">
                                <FaClock className="mini-icon" /> {order.sale_time_th || order.formatted_order_time?.split(' ')[1]} น.
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`order-type-badge type-${order.order_type || 'takeaway'}`}>
                              {order.order_type === 'delivery' ? (
                                <><FaMotorcycle /> จัดส่งเดลิเวอรี่</>
                              ) : order.order_type === 'dine_in' ? (
                                <><FaUtensils /> ทานที่ร้าน</>
                              ) : (
                                <><FaShoppingBag /> ซื้อกลับบ้าน</>
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="payment-badge">
                              {order.payment_method || "เงินสด"}
                            </span>
                          </td>
                          <td>
                            <span className="cashier-name-text">
                              {order.cashier_name}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="items-count-pill" title={`${uniqueCount} ชนิด (${totalItemsQty} ชิ้น)`}>
                              {uniqueCount} เมนู ({totalItemsQty} ชิ้น)
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "700", fontSize: "15px", color: "#059669" }}>
                            ฿{Number(order.total_amount).toLocaleString()}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn-view-bill"
                              onClick={() => setSelectedOrderModal(order)}
                              title="เปิดดูรายการเมนูทั้งหมดในบิลนี้"
                            >
                              <FaEye /> ดูรายการในบิล
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="no-data-msg">
                  {ordersSearch ? "ไม่พบบิลคำสั่งซื้อที่ตรงกับเงื่อนไขค้นหา" : "ไม่พบประวัติบิลคำสั่งซื้อในช่วงเวลานี้"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------
          แท็บ 4: การวิเคราะห์ข้อมูลเชิงลึก (Business Analytics & Insights)
         ---------------------------------------------------------------------------- */}
      {activeTab === "analytics" && (
        <div className="tab-analytics-container">
          <div className="insights-banner-card">
            <div className="insights-banner-icon">
              <FaLightbulb />
            </div>
            <div className="insights-banner-text">
              <h4>ข้อเสนอแนะเชิงกลยุทธ์ธุรกิจจากข้อมูลจริง (Business Intelligence)</h4>
              <p>
                ระบบได้วิเคราะห์พฤติกรรมคำสั่งซื้อในอดีตเพื่อสร้างข้อมูลเชิงลึกสำหรับการตั้งราคา, 
                การจัดโปรโมชัน และการคุมต้นทุนสต็อกสินค้า
              </p>
            </div>
          </div>

          <div className="analytics-grid">
            {/* 1. Market Basket Analysis */}
            <div className="report-card">
              <div className="card-header">
                <h4>
                  <FaExchangeAlt className="header-icon" /> Market Basket Analysis (สินค้าที่ซื้อคู่กันบ่อย)
                </h4>
                <span className="header-tag">สำหรับการจัด Combo Set / Cross-Selling</span>
              </div>
              <div className="card-body">
                <p className="card-description">
                  คู่สินค้าที่ลูกค้ามักจะสั่งซื้อในบิลเดียวกันบ่อยที่สุด สามารถนำไปจัดโปรโมชันคู่ 
                  เพื่อเพิ่มยอดขายเฉลี่ยต่อบิล (AOV)
                </p>
                <div className="basket-pairs-list">
                  {marketBasket.length > 0 ? (
                    marketBasket.map((pair, idx) => (
                      <div key={idx} className="basket-pair-item">
                        <div className="pair-products">
                          <span className="badge-prod">{pair.product_a}</span>
                          <span className="pair-plus">+</span>
                          <span className="badge-prod">{pair.product_b}</span>
                        </div>
                        <div className="pair-count">
                          <strong>{pair.pair_count}</strong> ครั้ง
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data-msg">ยังไม่มีข้อมูลคำสั่งซื้อที่มีสินค้าคู่กัน</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. ABC Inventory & Revenue Classification (Pareto 80/20) */}
            <div className="report-card">
              <div className="card-header">
                <h4>
                  <FaBoxOpen className="header-icon" /> ABC Analysis (การจำแนกความสำคัญสินค้า Pareto 80/20)
                </h4>
                <span className="header-tag">สำหรับบริหารสต็อกไม่ให้ของขาด</span>
              </div>
              <div className="card-body">
                <p className="card-description">
                  <strong>Grade A:</strong> กลุ่มสินค้า 20% ที่สร้างยอดขายหลัก 80% ให้ร้าน (ห้ามขาดสต็อกเด็ดขาด)<br />
                  <strong>Grade B:</strong> สินค้ารายได้ปานกลาง (15%) | <strong>Grade C:</strong> สินค้าขายช้า (5%)
                </p>
                <div className="abc-table-wrapper">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>สินค้า</th>
                        <th>หมวดหมู่</th>
                        <th style={{ textAlign: "right" }}>ยอดขาย</th>
                        <th style={{ textAlign: "right" }}>สัดส่วนสะสม</th>
                        <th>เกรดความสำคัญ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abcAnalysis.map((item) => (
                        <tr key={item.product_id}>
                          <td style={{ fontWeight: "600" }}>{item.product_name}</td>
                          <td>{item.category_name}</td>
                          <td style={{ textAlign: "right" }}>฿{Number(item.total_revenue).toLocaleString()}</td>
                          <td style={{ textAlign: "right", color: "#64748b" }}>{item.cumulative_pct}%</td>
                          <td>
                            <span className={`abc-badge ${item.abc_grade.startsWith('A') ? 'badge-a' : item.abc_grade.startsWith('B') ? 'badge-b' : 'badge-c'}`}>
                              {item.abc_grade.split(' ')[0]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 3. ศูนย์ส่งออกข้อมูลเพื่อทำ External Data Analysis & BI */}
          <div className="report-card" style={{ marginTop: "20px" }}>
            <div className="card-header">
              <h4>
                <FaDownload className="header-icon" /> ศูนย์ส่งออกข้อมูลเพื่อทำ Data Analysis & BI Tools
              </h4>
            </div>
            <div className="card-body">
              <div className="bi-export-box">
                <div className="bi-info-text">
                  <h5>ชุดข้อมูลระดับธุรกรรมรายการสินค้า (Item-Level Fact Data)</h5>
                  <p>
                    ไฟล์ CSV ที่ดาวน์โหลดจากระบบจะประกอบไปด้วยคอลัมน์สำคัญที่จัดรูปแบบมาตรฐาน Star Schema 
                    (Order ID, Date, Time, Hour, Day of Week, Cashier, Payment Method, Product ID, Name, Category, Quantity, Price, Total Amount)
                    พร้อมเปิดใช้งานใน:
                  </p>
                  <div className="bi-tools-tags">
                    <span className="bi-tag">Microsoft Power BI</span>
                    <span className="bi-tag">Google Looker Studio</span>
                    <span className="bi-tag">Microsoft Excel (Pivot Table)</span>
                    <span className="bi-tag">Python Pandas / Jupyter Notebook</span>
                    <span className="bi-tag">Tableau</span>
                  </div>
                </div>
                <div className="bi-action-btn">
                  <button className="btn-download-big" onClick={handleExportCSV}>
                    <FaDownload /> ดาวน์โหลดไฟล์ข้อมูล (CSV)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------
          5. MODAL: ป๊อปอัพแสดงรายการสินค้าในบิลคำสั่งซื้อ (Receipt / Bill Breakdown Modal)
         ---------------------------------------------------------------------------- */}
      {selectedOrderModal && (
        <div className="modal-overlay" onClick={() => setSelectedOrderModal(null)}>
          <div className="receipt-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* หัว Modal ใบเสร็จ */}
            <div className="receipt-modal-header">
              <div className="receipt-header-left">
                <div className="receipt-icon-badge">
                  <FaReceipt />
                </div>
                <div>
                  <h3 className="receipt-modal-title">
                    รายละเอียดคำสั่งซื้อ #{selectedOrderModal.order_id}
                  </h3>
                  <span className="receipt-modal-subtitle">
                    ใบสรุปรายการขายและสินค้าในบิล
                  </span>
                </div>
              </div>
              <button
                className="btn-close-modal"
                onClick={() => setSelectedOrderModal(null)}
                title="ปิดหน้าต่าง"
              >
                <FaTimes />
              </button>
            </div>

            {/* รายละเอียดหัวบิล */}
            <div className="receipt-modal-meta-grid">
              <div className="receipt-meta-item">
                <span className="meta-label">วัน-เวลา ที่ขายออก:</span>
                <span className="meta-val highlight-time">
                  <FaClock className="mini-icon" /> {selectedOrderModal.formatted_order_time || `${selectedOrderModal.sale_date_th} ${selectedOrderModal.sale_time_th}`} น.
                </span>
              </div>
              <div className="receipt-meta-item">
                <span className="meta-label">พนักงานแคชเชียร์:</span>
                <span className="meta-val">{selectedOrderModal.cashier_name}</span>
              </div>
              <div className="receipt-meta-item">
                <span className="meta-label">ประเภทออเดอร์:</span>
                <span className={`order-type-badge type-${selectedOrderModal.order_type || 'takeaway'}`}>
                  {selectedOrderModal.order_type === 'delivery' ? 'จัดส่งเดลิเวอรี่' : selectedOrderModal.order_type === 'dine_in' ? 'ทานที่ร้าน' : 'ซื้อกลับบ้าน'}
                </span>
              </div>
              <div className="receipt-meta-item">
                <span className="meta-label">วิธีชำระเงิน:</span>
                <span className="meta-val">{selectedOrderModal.payment_method || 'เงินสด'}</span>
              </div>
            </div>

            {/* ถ้าเป็น Delivery แสดงข้อมูลผู้รับ & ไรเดอร์ */}
            {selectedOrderModal.order_type === 'delivery' && (
              <div className="receipt-delivery-box">
                <div className="delivery-box-title">
                  <FaMotorcycle /> ข้อมูลการจัดส่งเดลิเวอรี่
                </div>
                <div className="delivery-box-grid">
                  <div><strong>ชื่อลูกค้า:</strong> {selectedOrderModal.customer_name || '-'}</div>
                  <div><strong>เบอร์โทร:</strong> {selectedOrderModal.customer_phone || '-'}</div>
                  <div className="col-span-2"><strong>ที่อยู่จัดส่ง:</strong> {selectedOrderModal.delivery_address || '-'}</div>
                  <div><strong>ไรเดอร์ผู้จัดส่ง:</strong> {selectedOrderModal.rider_name || 'ยังไม่มอบหมาย'}</div>
                  <div><strong>สถานะจัดส่ง:</strong> {selectedOrderModal.delivery_status || 'PENDING'}</div>
                  {selectedOrderModal.delivery_notes && (
                    <div className="col-span-2"><strong>หมายเหตุ:</strong> {selectedOrderModal.delivery_notes}</div>
                  )}
                </div>
              </div>
            )}

            {/* ตารางรายการสินค้าในบิล */}
            <div className="receipt-items-container">
              <h5 className="receipt-items-heading">
                <FaShoppingBag /> รายการเมนูที่สั่งซื้อ ({selectedOrderModal.items?.length || 0} รายการ)
              </h5>
              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px", textAlign: "center" }}>#</th>
                    <th>ชื่อเมนู</th>
                    <th>หมวดหมู่</th>
                    <th style={{ textAlign: "right" }}>ราคา/แก้ว</th>
                    <th style={{ textAlign: "center" }}>จำนวน</th>
                    <th style={{ textAlign: "right" }}>ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrderModal.items && selectedOrderModal.items.length > 0) ? (
                    selectedOrderModal.items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", color: "#94a3b8" }}>{idx + 1}</td>
                        <td style={{ fontWeight: "600", color: "#1e293b" }}>{it.product_name}</td>
                        <td><span className="category-pill">{it.category_name}</span></td>
                        <td style={{ textAlign: "right" }}>฿{Number(it.price || it.unit_price).toFixed(2)}</td>
                        <td style={{ textAlign: "center", fontWeight: "700" }}>{it.quantity}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", color: "#0f172a" }}>
                          ฿{(Number(it.price || it.unit_price) * Number(it.quantity)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>
                        ไม่พบรายละเอียดรายการสินค้า
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* สรุปยอดเงิน */}
            <div className="receipt-modal-total-summary">
              {Number(selectedOrderModal.delivery_fee) > 0 && (
                <div className="total-summary-row">
                  <span>ค่าจัดส่ง (Delivery Fee):</span>
                  <span>฿{Number(selectedOrderModal.delivery_fee).toFixed(2)}</span>
                </div>
              )}
              <div className="total-summary-row grand-total">
                <span>ยอดรวมสุทธิ (Grand Total):</span>
                <span>฿{Number(selectedOrderModal.total_amount).toLocaleString()}</span>
              </div>
              <div className="total-summary-row text-muted">
                <span>เงินที่รับมา (Received):</span>
                <span>฿{Number(selectedOrderModal.amount_received || selectedOrderModal.total_amount).toLocaleString()}</span>
              </div>
              <div className="total-summary-row text-muted">
                <span>เงินทอน (Change):</span>
                <span>฿{Number(selectedOrderModal.change_amount || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* ปุ่ม Action ท้าย Modal */}
            <div className="receipt-modal-footer">
              <button
                className="btn-print-receipt"
                onClick={() => window.print()}
                title="สั่งพิมพ์ใบเสร็จ"
              >
                <FaPrint /> พิมพ์ใบเสร็จ
              </button>
              <button
                className="btn-close-receipt"
                onClick={() => setSelectedOrderModal(null)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

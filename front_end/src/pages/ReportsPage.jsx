// ==============================================================================
// ไฟล์: front_end/src/pages/ReportsPage.jsx
// ระบบ: แดชบอร์ดรายงานยอดขายและวิเคราะห์ธุรกิจ (Sales Reporting & Data Analytics UI)
// วัตถุประสงค์:
//   - แสดงภาพรวมผลลัพธ์ทางธุรกิจ (KPIs): Gross Sales, Total Orders, Average Order Value (AOV)
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
} from "react-icons/fa";
import Swal from "sweetalert2";

export default function ReportsPage() {
  // ----------------------------------------------------------------------------
  // State Management:
  // - activeTab: แท็บที่เลือก ('overview' สำหรับภาพรวมยอดขาย, 'analytics' สำหรับ Data Analysis)
  // - dateRange: ตัวเลือกช่วงเวลา ('today', '7days', '30days', 'all', 'custom')
  // - startDate, endDate: วันที่เริ่มต้น-สิ้นสุดเมื่อเลือก 'custom'
  // - summaryData: ข้อมูลสรุปภาพรวมจาก API `/api/reports/summary`
  // - analyticsData: ข้อมูลวิเคราะห์เชิงลึกจาก API `/api/reports/analytics`
  // - loading: สถานะกำลังโหลด
  // ----------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("overview"); 
  const [dateRange, setDateRange] = useState("all"); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const [summaryData, setSummaryData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // ดึงข้อมูลใหม่ทุกครั้งที่ผู้ใช้เปลี่ยนช่วงเวลา (dateRange)
  useEffect(() => {
    fetchReportSummary();
    fetchAnalytics();
  }, [dateRange]);

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ดึงข้อมูลสรุปยอดขายตามช่วงเวลาที่เลือก
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
  // ฟังก์ชัน: ดึงข้อมูลการวิเคราะห์เชิงลึก (Market Basket & ABC Pareto)
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
  // ฟังก์ชัน: จัดการกดปุ่มกรองวันที่แบบระบุเอง (Custom Date Range)
  // ----------------------------------------------------------------------------
  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      Swal.fire("แจ้งเตือน", "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน", "warning");
      return;
    }
    setDateRange("custom");
    fetchReportSummary();
  };

  // ----------------------------------------------------------------------------
  // ฟังก์ชัน: ส่งออกไฟล์ CSV สำหรับนำไปทำ Data Analysis ในโปรแกรมอื่น
  // ----------------------------------------------------------------------------
  const handleExportCSV = () => {
    let url = `/api/reports/export?range=${dateRange}`;
    if (dateRange === "custom" && startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }
    // สั่งเปิด URL เพื่อให้เบราว์เซอร์เริ่มดาวน์โหลดไฟล์ CSV อัตโนมัติ
    window.open(url, "_blank");
    Swal.fire({
      icon: "success",
      title: "กำลังดาวน์โหลดข้อมูล!",
      text: "ระบบได้ส่งออกข้อมูลเพื่อนำไปทำ Data Analysis ใน Excel / Power BI เรียบร้อยแล้ว",
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // ดึงค่าสรุป KPIs หรือกำหนดค่าเริ่มต้นหากข้อมูลยังไม่มา
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

  // คำนวณหาชั่วโมงที่มียอดขายสูงสุด (Peak Hour)
  const peakHourItem = hourlyTrends.length > 0
    ? [...hourlyTrends].sort((a, b) => Number(b.total_sales) - Number(a.total_sales))[0]
    : null;

  // หายอดขายสูงสุดในบรรดาสินค้าเพื่อนำไปคิดสัดส่วน % ของ Progress Bar
  const maxProductRevenue = topProducts.length > 0
    ? Math.max(...topProducts.map((p) => Number(p.total_revenue)))
    : 1;

  // หายอดขายสูงสุดในรายชั่วโมงเพื่อนำไปคิดความสูงของแท่งกราฟ (Bar Chart Height)
  const maxHourlySales = hourlyTrends.length > 0
    ? Math.max(...hourlyTrends.map((h) => Number(h.total_sales)))
    : 1;

  return (
    <div className="reports-container">
      {/* 1. Header & Filter Toolbar */}
      <div className="reports-header-section">
        <div className="header-titles">
          <h2>
            <FaChartBar className="icon-title" /> หน้ารายงานผลลัพธ์การขายและวิเคราะห์ธุรกิจ
          </h2>
          <p className="subtitle">
            รายงานตัวเลขการขาย ข้อมูลเชิงลึก และชุดข้อมูลสำหรับทำ Business Data Analysis
          </p>
        </div>

        <div className="header-actions">
          {/* ปุ่ม Export CSV สำหรับ Data Analysis */}
          <button className="btn-export-csv" onClick={handleExportCSV} title="ดาวน์โหลดไฟล์ CSV สำหรับทำ Data Analysis">
            <FaDownload /> Export ข้อมูล (CSV)
          </button>
          <button className="btn-refresh" onClick={fetchReportSummary} title="รีเฟรชข้อมูล">
            <FaSyncAlt /> รีเฟรช
          </button>
        </div>
      </div>

      {/* 2. แถบเลือกช่วงเวลา (Date Filter Bar) */}
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

      {/* 3. การ์ดสรุปตัวชี้วัดหลัก (Executive KPI Cards) */}
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

      {/* 4. สลับแท็บระหว่าง "ภาพรวมการขาย" และ "การวิเคราะห์เชิงลึก" */}
      <div className="report-tabs">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <FaChartBar /> 1. ภาพรวมผลลัพธ์การขาย (Sales Overview)
        </button>
        <button
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          <FaLightbulb /> 2. วิเคราะห์ข้อมูลธุรกิจ (Business Analytics & Insights)
        </button>
      </div>

      {/* 5. เนื้อหาภายในแท็บ */}
      {loading ? (
        <div className="loading-box">กำลังประมวลผลข้อมูลการขาย...</div>
      ) : activeTab === "overview" ? (
        /* ================= TAB 1: ภาพรวมผลการขาย ================= */
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

              {/* ยอดขายตามหมวดหมู่ */}
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
      ) : (
        /* ================= TAB 2: DATA ANALYSIS & BUSINESS INSIGHTS ================= */
        <div className="tab-analytics-container">
          {/* ป้ายกลยุทธ์ธุรกิจจากข้อมูลจริง (Business Intelligence Banner) */}
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
    </div>
  );
}

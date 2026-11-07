// ไฟล์: front_end/src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Swal from 'sweetalert2';
import './LoginPage.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // คำนวณปลายทางที่จะไปหลังล็อกอิน
  const getDestinationUrl = (user) => {
    // ถ้ามี redirect query เช่น /login?redirect=/rider-delivery ให้พาไปหน้านั้น
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get('redirect');
    if (redirectUrl) return redirectUrl;

    const userRoleId = Number(user?.role_id) || 0;
    const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
    
    // ถ้าเป็นไรเดอร์ (Role = 3 หรือมี menu_rider)
    if (userPermissions.includes("menu_rider") || userRoleId === 3 || user?.role === 'Rider') {
      return '/rider-delivery';
    }
    return '/pos';
  };

  // 1. ดักจับคนที่ล็อกอินอยู่แล้ว ไม่ให้เข้าหน้า Login ซ้ำ
  useEffect(() => {
    const loggedInUser = sessionStorage.getItem('user');
    if (loggedInUser) {
      const user = JSON.parse(loggedInUser);
      window.location.replace(getDestinationUrl(user));
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      // ใช้ relative path '/api/auth/login' เพื่อให้เรียกผ่าน Vite Proxy ได้ทั้งบน localhost และ Cloudflare Tunnel
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // บันทึกข้อมูลลง Session
        sessionStorage.setItem('user', JSON.stringify(data.user));
        
        // แจ้งเตือนความสำเร็จ
        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ!',
          text: `ยินดีต้อนรับ ${data.user.name || data.user.first_name || ''} (${data.user.role || ''})`,
          showConfirmButton: false,
          timer: 1500 
        }).then(() => {
          window.location.replace(getDestinationUrl(data.user));
        });

      } else {
        // รหัสผ่านผิด หรือไม่พบผู้ใช้
        setErrorMsg(data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMsg('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">ระบบจัดการร้าน POS Cafe</h2>
        
        {errorMsg && (
          <div className="error-message">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้งาน</label>
            <input 
              type="text" 
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="กรอกชื่อผู้ใช้งาน"
            />
          </div>

          <div className="form-group last">
            <label className="form-label">รหัสผ่าน</label>
            <div className="password-input-container">
              <input 
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="กรอกรหัสผ่าน"
              />
              <span 
                className="password-toggle-icon" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>

          <button type="submit" className="submit-button">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

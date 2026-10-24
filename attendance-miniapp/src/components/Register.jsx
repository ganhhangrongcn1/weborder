import { useState } from "react";

function RegisterIcon({ type }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === "user" ? <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : type === "phone" ? <path d="m5 3 4 1 1 5-3 2a15 15 0 0 0 6 6l2-3 5 1 1 4c-1 4-7 3-12-2S1 4 5 3Z"/> : type === "eye" ? <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></>}</svg>;
}


export default function Register({ onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = (event) => {
    event.preventDefault(); setError("");
    if (name.trim().length < 2) return setError("Vui lòng nhập họ tên đầy đủ.");
    if (!/^(?:0|\+84|84)[35789]\d{8}$/.test(phone.replace(/[ .()-]/g, ""))) return setError("Vui lòng nhập số điện thoại di động Việt Nam hợp lệ (10 số hoặc +84).");
    if (password.length < 8) return setError("Mật khẩu cần ít nhất 8 ký tự.");
    if (password !== confirm) return setError("Mật khẩu nhập lại chưa khớp.");
    setPassword(""); setConfirm(""); setDone(true);
  };
  return <section className="login-panel" aria-labelledby="register-title"><h1 id="register-title">Đăng ký tài khoản</h1>
    {done ? <><p role="status" className="notice success">Đã hoàn tất đăng ký mẫu · Chờ kích hoạt.</p><p>Bản Testing chỉ mô phỏng đăng ký, chưa tạo tài khoản trong hệ thống. Tài khoản vừa nhập chưa dùng đăng nhập được.</p><button className="primary login-submit" onClick={onBack}>Về đăng nhập</button></> : <form onSubmit={submit}>
      <label htmlFor="register-name">Họ và tên</label><div className="login-input"><RegisterIcon type="user"/><input id="register-name" placeholder="Họ tên của bạn" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)}/></div>
      <label htmlFor="register-phone">Số điện thoại</label><div className="login-input"><RegisterIcon type="phone"/><input id="register-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Số điện thoại của bạn" required maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} aria-describedby="register-phone-help"/></div>
      <p id="register-phone-help" className="small">Số điện thoại là tài khoản đăng nhập của bạn.</p>
      <label htmlFor="register-password">Mật khẩu</label><div className="login-input"><RegisterIcon type="lock"/><input id="register-password" type={visible ? "text" : "password"} placeholder="Ít nhất 8 ký tự" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)}/><button type="button" className="password-toggle" aria-label={visible ? "Ẩn mật khẩu đăng ký" : "Hiện mật khẩu đăng ký"} aria-pressed={visible} onClick={() => setVisible(!visible)}><RegisterIcon type="eye"/></button></div>
      <label htmlFor="register-confirm">Xác nhận mật khẩu</label><div className="login-input"><RegisterIcon type="lock"/><input id="register-confirm" type="password" placeholder="Nhập lại mật khẩu" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)}/></div>
      {error && <p className="notice error" role="alert">{error}</p>}<button className="primary login-submit">Đăng ký tài khoản</button><p className="register-signin">Đã có tài khoản? <button type="button" onClick={onBack}>Đăng nhập</button></p>
    </form>}
  </section>;
}

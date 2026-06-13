import { useState } from "react";
import { loginPosAccount } from "../../services/posSessionService.js";

export default function PosLoginScreen({ branches = [], onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await loginPosAccount({ branches, email, password });
    setLoading(false);
    if (!result.ok) {
      setError(result.message || "Đăng nhập POS thất bại.");
      return;
    }
    onLogin(result.session);
  };

  return (
    <main className="pos-login-page">
      <form className="pos-login-card" onSubmit={handleSubmit}>
        <div className="pos-login-brand">
          <span>GHR</span>
          <div>
            <strong>Đăng nhập POS</strong>
            <small>Mỗi tài khoản chỉ thao tác trên chi nhánh đã được gán.</small>
          </div>
        </div>
        <label>
          <span>Email POS</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Ví dụ: 30t@ghr.vn" />
        </label>
        <label>
          <span>Mật khẩu</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" type="password" />
        </label>
        {error ? <div className="pos-login-error">{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Đang vào POS..." : "Vào POS"}
        </button>
      </form>
    </main>
  );
}


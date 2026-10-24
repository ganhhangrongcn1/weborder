import logo from "../assets/ghr-logo.png";

export default function Brand({ showSubtitle = true }) {
  return <div className="brand"><img src={logo} alt="Gánh Hàng Rong"/><div><strong>Gánh Hàng Rong</strong>{showSubtitle && <span>Chấm công nhân viên</span>}</div></div>;
}

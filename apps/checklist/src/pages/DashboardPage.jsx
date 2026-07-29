import { Buildings, CalendarCheck, ClipboardText, UsersThree } from "@phosphor-icons/react";
import { useBranches } from "../hooks/useBranches.js";

const PHASE_ITEMS = [
  { icon: ClipboardText, label: "Mẫu checklist", value: "37 tiêu chí", tone: "yellow" },
  { icon: CalendarCheck, label: "Chu kỳ kiểm tra", value: "2 ngày/lần", tone: "green" },
  { icon: UsersThree, label: "Nhân viên", value: "Sẵn sàng Phase 2", tone: "blue" }
];

export default function DashboardPage({ profile }) {
  const branches = useBranches();

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Nền tảng đã sẵn sàng</p>
          <h1>Chào {profile?.name || "Admin"}</h1>
          <p>Phase 1 kết nối tài khoản và chi nhánh. Quản trị nhân viên, checklist sẽ được mở ở Phase 2.</p>
        </div>
        <span className="phase-badge">Phase 1</span>
      </header>

      <section className="metric-grid" aria-label="Tổng quan nền tảng">
        <article className="metric-card metric-card--wide">
          <span className="metric-icon metric-icon--red"><Buildings weight="fill" /></span>
          <div>
            <span>Chi nhánh đang hoạt động</span>
            <strong>{branches.loading ? "…" : branches.data.length}</strong>
            <small>{branches.error || "Đồng bộ từ nguồn branches hiện tại"}</small>
          </div>
        </article>
        {PHASE_ITEMS.map(({ icon: Icon, label, value, tone }) => (
          <article className="metric-card" key={label}>
            <span className={`metric-icon metric-icon--${tone}`}><Icon weight="fill" /></span>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="foundation-panel">
        <div>
          <p className="eyebrow">Trạng thái hệ thống</p>
          <h2>Nền dữ liệu tách biệt, liên kết đúng nguồn</h2>
        </div>
        <ul>
          <li><span>01</span><div><strong>Tài khoản</strong><p>Dùng Supabase Auth và quyền admin trong profiles.</p></div></li>
          <li><span>02</span><div><strong>Chi nhánh</strong><p>Dùng branch_uuid ổn định, không tạo dữ liệu trùng.</p></div></li>
          <li><span>03</span><div><strong>Checklist</strong><p>Các bảng checklist_* độc lập với đơn hàng và POS.</p></div></li>
        </ul>
      </section>
    </div>
  );
}

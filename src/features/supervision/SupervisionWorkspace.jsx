import { useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import CorrectiveActionsPanel from "./CorrectiveActionsPanel.jsx";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function scoreTone(score) {
  if (Number(score) >= 90) return "good";
  if (Number(score) >= 75) return "warning";
  return "danger";
}

export default function SupervisionWorkspace({ adminAuth, setup, working, error, branchUuid, employeeIds, branchEmployees, onBranchChange, onToggleEmployee, onBegin, onResume, onViewReport }) {
  const [activeTab, setActiveTab] = useState("home");
  const [historyBranch, setHistoryBranch] = useState("");
  const history = setup?.history || [];
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthHistory = useMemo(() => history.filter((item) => String(item.submitted_at || "").startsWith(monthKey)), [history, monthKey]);
  const averageScore = monthHistory.length ? monthHistory.reduce((sum, item) => sum + Number(item.score || 0), 0) / monthHistory.length : 0;
  const attentionCount = monthHistory.filter((item) => item.has_critical_failure || Number(item.score) < 75).length;
  const filteredHistory = historyBranch ? history.filter((item) => item.branch_uuid === historyBranch) : history;
  const profileName = adminAuth?.adminProfile?.name || adminAuth?.adminProfile?.email || "Giám sát";
  const isAdmin = String(adminAuth?.adminProfile?.role || "").toLowerCase() === "admin";

  return <main className="supervision-workspace">
    <header className="workspace-header"><div className="supervision-brand"><span><img src="/pwa-icon-192.png" alt="Logo Gánh Hàng Rong" /></span><div><strong>Không gian giám sát</strong><small>{profileName}</small></div></div><button type="button" aria-label="Đăng xuất" onClick={adminAuth?.onAdminLogout}><Icon name="logout" size={18} /></button></header>

    <div className="workspace-content">
      {activeTab === "corrective" ? <CorrectiveActionsPanel adminMode={isAdmin} /> : null}
      {activeTab === "home" ? <>
        <section className="workspace-welcome"><p>Hoạt động hôm nay</p><h1>Chào {profileName.split(" ").slice(-2).join(" ")}</h1><span>Bắt đầu kiểm tra hoặc tiếp tục biên bản đang làm dở.</span></section>
        <section className="workspace-kpis" aria-label="Tổng quan tháng này"><article><span>Tháng này</span><strong>{monthHistory.length}</strong><small>Biên bản hoàn tất</small></article><article><span>Điểm trung bình</span><strong>{averageScore.toFixed(1)}</strong><small>Trên thang điểm 100</small></article><article className={attentionCount ? "attention" : ""}><span>Cần lưu ý</span><strong>{attentionCount}</strong><small>Biên bản dưới 75 hoặc lỗi nặng</small></article></section>
        {setup?.drafts?.length ? <section className="workspace-section"><header><div><p>Đang thực hiện</p><h2>Biên bản làm dở</h2></div></header><div className="workspace-drafts">{setup.drafts.map((item) => <button type="button" key={item.id} disabled={working} onClick={() => onResume(item.id)}><span><strong>{item.branch_name_snapshot}</strong><small>{item.inspection_code} · bắt đầu {formatDate(item.started_at)}</small></span><b>Tiếp tục →</b></button>)}</div></section> : null}
        <section className="workspace-start"><div><p>Bắt đầu biên bản</p><h2>Kiểm tra cửa hàng</h2><span>Chọn chi nhánh và nhân viên đang có mặt tại thời điểm kiểm tra.</span></div><label className="supervision-field"><span>Chi nhánh <b>*</b></span><select value={branchUuid} onChange={(event) => onBranchChange(event.target.value)}><option value="">Chọn chi nhánh</option>{setup?.branches.map((branch) => <option key={branch.branch_uuid} value={branch.branch_uuid}>{branch.name}</option>)}</select></label>{branchUuid ? <fieldset className="supervision-employees"><legend>Nhân viên có mặt</legend>{branchEmployees.length ? branchEmployees.map((employee) => <label key={employee.id}><input type="checkbox" checked={employeeIds.includes(employee.id)} onChange={() => onToggleEmployee(employee.id)} /><span><strong>{employee.full_name}</strong><small>{employee.employee_code} · {employee.position_name}</small></span></label>) : <p>Chi nhánh này chưa có nhân viên đang hoạt động.</p>}</fieldset> : null}{error ? <p className="supervision-error">{error}</p> : null}<button className="supervision-primary" type="button" disabled={!branchUuid || working} onClick={onBegin}>{working ? "Đang tạo biên bản…" : `Bắt đầu kiểm tra · ${setup?.items?.length || 0} tiêu chí`}</button></section>
        {history.length ? <section className="workspace-section workspace-recent"><header><div><p>Gần đây</p><h2>Biên bản mới nhất</h2></div><button type="button" onClick={() => setActiveTab("history")}>Xem tất cả</button></header>{history.slice(0, 3).map((item) => <HistoryRow key={item.id} item={item} onView={onViewReport} />)}</section> : null}
      </> : null}

      {activeTab === "history" ? <section className="workspace-history"><header><p>Lịch sử của tôi</p><h1>Biên bản đã hoàn tất</h1><span>Chỉ hiển thị các biên bản do tài khoản này thực hiện.</span></header><label><span>Lọc theo chi nhánh</span><select value={historyBranch} onChange={(event) => setHistoryBranch(event.target.value)}><option value="">Tất cả chi nhánh</option>{setup?.branches.map((branch) => <option key={branch.branch_uuid} value={branch.branch_uuid}>{branch.name}</option>)}</select></label><div>{filteredHistory.length ? filteredHistory.map((item) => <HistoryRow key={item.id} item={item} onView={onViewReport} />) : <p className="workspace-empty">Chưa có biên bản phù hợp.</p>}</div></section> : null}

      {activeTab === "account" ? <section className="workspace-account"><div className="account-avatar">{profileName.slice(0, 1).toUpperCase()}</div><p>Tài khoản giám sát</p><h1>{profileName}</h1><dl><div><dt>Vai trò</dt><dd>{isAdmin ? "Quản trị viên" : "Giám sát"}</dd></div><div><dt>Chi nhánh</dt><dd>{isAdmin ? "Toàn hệ thống" : `${(adminAuth?.checklistAccess || []).filter((item) => item.role === "supervisor" && item.branch_uuid).length} chi nhánh được phân công`}</dd></div><div><dt>Quyền thao tác</dt><dd>Tạo và xem biên bản kiểm tra</dd></div><div><dt>Cấu hình checklist</dt><dd>Chỉ quản trị viên chỉnh sửa trong Admin</dd></div></dl><button type="button" onClick={adminAuth?.onAdminLogout}><Icon name="logout" size={18} /> Đăng xuất</button></section> : null}
    </div>

    <nav className="workspace-bottom-nav" aria-label="Điều hướng giám sát"><button type="button" className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}><Icon name="home" size={21} /><span>Tổng quan</span></button><button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}><Icon name="list" size={21} /><span>Biên bản</span></button><button type="button" className={activeTab === "corrective" ? "active" : ""} onClick={() => setActiveTab("corrective")}><Icon name="check" size={21} /><span>Khắc phục</span></button><button type="button" className={activeTab === "account" ? "active" : ""} onClick={() => setActiveTab("account")}><Icon name="user" size={21} /><span>Tài khoản</span></button></nav>
  </main>;
}

function HistoryRow({ item, onView }) {
  return <button type="button" className="workspace-history-row" onClick={() => onView(item.id)}><div><strong>{item.branch_name_snapshot}</strong><small>{formatDate(item.submitted_at)} · {item.inspection_code}</small></div><span className={scoreTone(item.score)}><b>{Number(item.score || 0).toFixed(1)}</b><small>{item.rating || "Đã hoàn tất"}</small></span><Icon name="eye" size={18} /></button>;
}

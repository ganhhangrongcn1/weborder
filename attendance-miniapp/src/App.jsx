import Membership from "./components/Membership.jsx";
import useMemberPoints from "./features/membership/useMemberPoints.js";
import useAppNavigation from "./hooks/useAppNavigation.js";
import BranchDetails from "./components/BranchDetails.jsx";
import { useEffect } from "react";
import useAttendance from "./hooks/useAttendance.js";
import Login from "./components/Login.jsx";
import Checkin from "./components/Checkin.jsx";
import History from "./components/History.jsx";
import Corrections from "./components/Corrections.jsx";
import Training from "./components/Training.jsx";
import Account from "./components/Account.jsx";
import Brand from "./components/Brand.jsx";
import NavigationIcon from "./components/NavigationIcon.jsx";
import { employeeName } from "./services/attendancePresentation.js";

const tabs = [["membership", "Tích điểm", "06"], ["checkin", "Chấm công", "01"], ["history", "Lịch sử", "02"], ["corrections", "Điều chỉnh", "03"], ["training", "Đào tạo", "04"], ["account", "Tài khoản", "05"]];
const screens = { membership: Membership, checkin: Checkin, history: History, corrections: Corrections, training: Training, account: Account, branch: BranchDetails };

export default function App() {
  const app = useAttendance(); const navigation = useAppNavigation(); const tab = navigation.page;
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  if (!app.actor) return <Login app={app}/>;
  if (!app.state) return <main className="attendance-loading"><p role="status">Đang tải dữ liệu…</p>{app.error && <p role="alert">{app.error}</p>}</main>;
  return <MemberWorkspace key={app.actor.id} app={app} navigation={navigation} tab={tab}/>;
}

function MemberWorkspace({ app, navigation, tab }) {
  const membership = useMemberPoints(app.actor);
  const Screen = screens[tab];
  return <div className="attendance-app"><aside className="sidebar"><Brand/><nav aria-label="Tích điểm và chấm công">{tabs.map(([id, label]) => <button key={id} disabled={app.busy} aria-current={tab === id ? "page" : undefined} onClick={() => { app.clearNotices(); navigation.navigate(id); }}><NavigationIcon name={id}/><span>{label}</span></button>)}</nav><div className="sidebar-footer">Gánh Hàng Rong · Nhân sự</div></aside>
    <div className="workspace"><header><button aria-label="Quay lại trang trước" onClick={navigation.back}>←</button><div className="header-brand"><Brand/></div><div className="header-profile"><span className="avatar">{employeeName(app.actor.name).split(" ").at(-1)?.slice(0, 1)}</span><div><strong>{employeeName(app.actor.name)}</strong><small>{app.actor.role === "manager" ? "Quản lý" : "Nhân viên"}</small></div></div><button className="logout-button" disabled={app.busy} onClick={app.logout}>Đăng xuất</button></header>
      <main><div className="page-title"><div><p className="eyebrow">Gánh Hàng Rong · Nhân sự</p><h1>{tabs.find(([id]) => id === tab)?.[1] || "Chi nhánh"}</h1></div><span className="badge">{app.actor.role === "manager" ? "Quản lý" : "Nhân viên"}</span></div>
      {app.error && <div role="alert" className="notice error">{app.error}</div>}{app.message && <div role="status" className="notice success">{app.message}</div>}{app.busy && <div role="status" className="notice">Đang xử lý…</div>}
      <Screen app={app} navigation={navigation} membership={membership}/><footer>Gánh Hàng Rong · Hệ thống chấm công nhân viên</footer></main>
    </div></div>;
}

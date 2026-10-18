import GanhReplyBoundary from "../ganh-reply/GanhReplyBoundary.jsx";
import AdminDashboardPage from "./AdminDashboardPage.jsx";
import AdminOrdersPage from "./AdminOrdersPage.jsx";
import AdminCustomersPage from "./AdminCustomersPage.jsx";
import AdminMenuPage from "./AdminMenuPage.jsx";
import AdminStorePage from "./AdminStorePage.jsx";
import AdminPromoPage from "./AdminPromoPage.jsx";
import AdminCakesPage from "./AdminCakesPage.jsx";
import AdminShiftOverviewPage from "./AdminShiftOverviewPage.jsx";
import AdminEmployeesPage from "./AdminEmployeesPage.jsx";
import AdminSupervisionPage from "./AdminSupervisionPage.jsx";
import AdminPartnerReviewsPage from "./AdminPartnerReviewsPage.jsx";
import AdminReviewRewardsPage from "./AdminReviewRewardsPage.jsx";
import AdminGrabFinancePage from "./AdminGrabFinancePage.jsx";
import { lazy, Suspense } from "react";
import AdminGrabMarketingPage from "./AdminGrabMarketingPage.jsx";

const AdminRecruitmentPage = lazy(() => import("../recruitment/AdminRecruitmentPage.jsx"));
const GanhReplyWorkspace = lazy(() => import("../ganh-reply/GanhReplyWorkspace.jsx"));

const InventoryWorkspace = lazy(() => import("../inventory/InventoryWorkspace.jsx"));

function InventoryLoadingState() {
  return <div className="inventory-state inventory-state--loading" role="status">Đang mở Quản lý kho…</div>;
}

export default function AdminPageContent({ section, ...props }) {
  if (section === "ganh-reply") return <GanhReplyBoundary><Suspense fallback={<div role="status">Đang mở Gánh Reply…</div>}><GanhReplyWorkspace /></Suspense></GanhReplyBoundary>;

  if (section === "dashboard") {
    return <AdminDashboardPage {...props} />;
  }

  if (section === "grab-finance") {
    return <AdminGrabFinancePage {...props} />;
  }
  if (section === "grab-marketing") return <AdminGrabMarketingPage {...props} />;

  if (section === "orders") {
    return <AdminOrdersPage {...props} />;
  }

  if (section === "shifts") {
    return <AdminShiftOverviewPage {...props} />;
  }

  if (section === "recruitment") {
    if (props.adminProfile?.role !== "admin" || props.adminProfile?.branch_uuid || props.adminProfile?.branchUuid) {
      return <p role="status">Tài khoản chưa có quyền quản trị tuyển dụng.</p>;
    }
    return <Suspense fallback={<p role="status">Đang mở Tuyển dụng…</p>}><AdminRecruitmentPage /></Suspense>;
  }

  if (section === "employees") {
    return <AdminEmployeesPage {...props} />;
  }

  if (section === "supervision") {
    return <AdminSupervisionPage {...props} />;
  }

  if (section === "partner-reviews") {
    return <AdminPartnerReviewsPage {...props} />;
  }

  if (section === "review-rewards") {
    if (String(props.adminProfile?.role || "").trim().toLowerCase() !== "admin") {
      return <div role="status">Tài khoản chưa có quyền quản trị thưởng đánh giá.</div>;
    }
    return <AdminReviewRewardsPage {...props} />;
  }

  if (section === "customers") {
    return <AdminCustomersPage {...props} />;
  }

  if (section === "cakes") {
    return <AdminCakesPage {...props} />;
  }

  if (section === "menu") {
    return <AdminMenuPage {...props} />;
  }

  if (section === "inventory") {
    return (
      <Suspense fallback={<InventoryLoadingState />}>
        <InventoryWorkspace {...props} />
      </Suspense>
    );
  }

  if (section === "store") {
    return <AdminStorePage {...props} />;
  }

  if (section === "promo") {
    return <AdminPromoPage {...props} />;
  }

  return null;
}

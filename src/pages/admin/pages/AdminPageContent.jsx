import AdminDashboardPage from "./AdminDashboardPage.jsx";
import AdminOrdersPage from "./AdminOrdersPage.jsx";
import AdminCustomersPage from "./AdminCustomersPage.jsx";
import AdminMenuPage from "./AdminMenuPage.jsx";
import AdminStorePage from "./AdminStorePage.jsx";
import AdminPromoPage from "./AdminPromoPage.jsx";

export default function AdminPageContent({ section, ...props }) {
  if (section === "dashboard") {
    return <AdminDashboardPage {...props} />;
  }

  if (section === "orders") {
    return <AdminOrdersPage {...props} />;
  }

  if (section === "customers") {
    return <AdminCustomersPage {...props} />;
  }

  if (section === "menu") {
    return <AdminMenuPage {...props} />;
  }

  if (section === "store") {
    return <AdminStorePage {...props} />;
  }

  if (section === "promo") {
    return <AdminPromoPage {...props} />;
  }

  return null;
}

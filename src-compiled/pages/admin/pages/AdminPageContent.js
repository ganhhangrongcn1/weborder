import AdminDashboardPage from "./AdminDashboardPage.js";
import AdminOrdersPage from "./AdminOrdersPage.js";
import AdminCustomersPage from "./AdminCustomersPage.js";
import AdminMenuPage from "./AdminMenuPage.js";
import AdminStorePage from "./AdminStorePage.js";
import AdminPromoPage from "./AdminPromoPage.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminPageContent({
  section,
  ...props
}) {
  if (section === "dashboard") {
    return /*#__PURE__*/_jsx(AdminDashboardPage, {
      ...props
    });
  }
  if (section === "orders") {
    return /*#__PURE__*/_jsx(AdminOrdersPage, {
      ...props
    });
  }
  if (section === "customers") {
    return /*#__PURE__*/_jsx(AdminCustomersPage, {
      ...props
    });
  }
  if (section === "menu") {
    return /*#__PURE__*/_jsx(AdminMenuPage, {
      ...props
    });
  }
  if (section === "store") {
    return /*#__PURE__*/_jsx(AdminStorePage, {
      ...props
    });
  }
  if (section === "promo") {
    return /*#__PURE__*/_jsx(AdminPromoPage, {
      ...props
    });
  }
  return null;
}
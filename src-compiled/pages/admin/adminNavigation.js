export const navGroups = [
  {
    title: "Tổng quan",
    items: [{ id: "dashboard-main", label: "Dashboard", section: "dashboard" }]
  },
  {
    title: "Vận hành",
    items: [
      { id: "orders-main", label: "Đơn hàng", section: "orders" },
      { id: "customer-main", label: "Khách hàng / CRM", section: "customers" },
    ]
  },
  {
    title: "Cửa hàng",
    items: [
      { id: "menu-main", label: "Menu", section: "menu" },
      { id: "store-branches", label: "Quản lý chi nhánh", section: "store", sub: "branches" },
      { id: "store-zalo", label: "Cấu hình Zalo", section: "store", sub: "zalo" },
    ]
  },
  {
    title: "Giao diện & KM",
    items: [
      { id: "store-ui", label: "Quản lý giao diện", section: "promo", sub: "ui" },
      { id: "promo-campaign", label: "Chương trình khuyến mãi", section: "promo", sub: "campaign" },
    ]
  }
];

export const navIconMap = {
  "dashboard-main": "home",
  "orders-main": "bag",
  "customer-main": "user",
  "menu-main": "menu",
  "store-branches": "home",
  "store-zalo": "phone",
  "store-ui": "star",
  "promo-campaign": "gift"
};

export const dashboardQuickActions = [
  { id: "orders-main", label: "Đơn hàng" },
  { id: "menu-main", label: "Menu" },
  { id: "customer-main", label: "Khách hàng / CRM" },
  { id: "store-branches", label: "Chi nhánh" },
  { id: "promo-campaign", label: "Khuyến mãi" }
];

export function getAdminPageTitle(section) {
  if (section === "dashboard") return "Dashboard";
  if (section === "orders") return "Quản lý đơn hàng";
  if (section === "customers") return "Khách hàng / CRM";
  if (section === "menu") return "Quản lý menu";
  if (section === "promo") return "Quản lý giao diện / khuyến mãi";
  return "Cài đặt cửa hàng";
}

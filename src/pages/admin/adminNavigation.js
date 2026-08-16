export const navGroups = [
  {
    id: "overview",
    title: "Tổng quan",
    icon: "home",
    items: [
      { id: "dashboard-main", label: "Dashboard", section: "dashboard" }
    ]
  },
  {
    id: "sales-operations",
    title: "Bán hàng & vận hành",
    icon: "bag",
    items: [
      { id: "orders-main", label: "Đơn hàng", section: "orders" },
      { id: "shifts-main", label: "Tổng quan ca", section: "shifts" },
      { id: "cakes-main", label: "Bánh sinh nhật", section: "cakes" },
      { id: "partner-reviews-main", label: "Đánh giá đối tác", section: "partner-reviews" },
      { id: "review-rewards-main", label: "Thưởng điểm đánh giá", section: "review-rewards" }
    ]
  },
  {
    id: "customers-marketing",
    title: "Khách hàng & marketing",
    icon: "user",
    items: [
      { id: "customer-main", label: "Khách hàng / CRM", section: "customers" },
      { id: "voucher-main", label: "Kho voucher", section: "promo", sub: "vouchers", campaignTab: "coupon" },
      { id: "sales-promotions-main", label: "Ưu đãi bán hàng", section: "promo", sub: "sales", campaignTab: "free_shipping" },
      { id: "grab-marketing-main", label: "Hiệu quả Marketing Grab", section: "grab-marketing" }
    ]
  },
  {
    id: "store-channels",
    title: "Cửa hàng & kênh bán",
    icon: "store",
    items: [
      { id: "menu-main", label: "Menu", section: "menu" },
      { id: "store-branches", label: "Quản lý chi nhánh", section: "store", sub: "branches" },
      { id: "store-ui", label: "Quản lý giao diện", section: "promo", sub: "ui" }
    ]
  },
  {
    id: "finance-reports",
    title: "Tài chính & báo cáo",
    icon: "wallet",
    items: [
      { id: "grab-finance-main", label: "Tài chính Grab", section: "grab-finance" }
    ]
  },
  {
    id: "people-supervision",
    title: "Nhân sự & giám sát",
    icon: "user",
    items: [
      { id: "employees-main", label: "Quản lý nhân sự", section: "employees" },
      { id: "supervision-main", label: "Quản lý giám sát", section: "supervision" }
    ]
  },
  {
    id: "system-settings",
    title: "Thiết lập hệ thống",
    icon: "gear",
    items: [
      { id: "store-accounts", label: "Tài khoản chi nhánh", section: "store", sub: "accounts" },
      { id: "store-zalo", label: "Cấu hình Zalo", section: "store", sub: "zalo" },
      { id: "store-downloads", label: "File APK POS", section: "store", sub: "downloads" }
    ]
  }
];

export const navIconMap = {
  "dashboard-main": "home",
  "grab-finance-main": "wallet",
  "grab-marketing-main": "sale",
  "orders-main": "bag",
  "partner-reviews-main": "star",
  "review-rewards-main": "gift",
  "shifts-main": "clock",
  "sales-promotions-main": "sale",
  "customer-main": "user",
  "voucher-main": "gift",
  "cakes-main": "gift",
  "menu-main": "menu",
  "store-branches": "home",
  "store-accounts": "user",
  "store-zalo": "phone",
  "store-downloads": "download",
  "store-ui": "star",
  "promo-campaign": "gift",
  "employees-main": "user",
  "supervision-main": "star"
};

export const dashboardQuickActions = [
  { id: "orders-main", label: "Đơn hàng" },
  { id: "partner-reviews-main", label: "Đánh giá đối tác" },
  { id: "review-rewards-main", label: "Thưởng điểm đánh giá" },
  { id: "shifts-main", label: "Tổng quan ca" },
  { id: "cakes-main", label: "Bánh sinh nhật" },
  { id: "menu-main", label: "Menu" },
  { id: "customer-main", label: "Khách hàng / CRM" },
  { id: "store-branches", label: "Chi nhánh" },
  { id: "store-accounts", label: "Tài khoản chi nhánh" },
  { id: "store-downloads", label: "File APK POS" },
  { id: "sales-promotions-main", label: "Ưu đãi bán hàng" }
];

export function getAdminPageTitle(section, activeAdminNav = "") {
  if (section === "dashboard") return "Dashboard";
  if (section === "grab-finance") return "Tài chính Grab";
  if (section === "grab-marketing") return "Hiệu quả Marketing Grab";
  if (section === "orders") return "Quản lý đơn hàng";
  if (section === "partner-reviews") return "Quản lý đánh giá đối tác";
  if (section === "review-rewards") return "Thưởng điểm đánh giá";
  if (section === "shifts") return "Tổng quan ca";
  if (section === "customers") return "Khách hàng / CRM";
  if (section === "cakes") return "Bánh sinh nhật bánh tráng";
  if (section === "menu") return "Quản lý menu";
  if (section === "employees") return "Quản lý nhân sự";
  if (section === "supervision") return "Quản lý giám sát";
  if (section === "promo" && activeAdminNav === "voucher-main") return "Kho voucher";
  if (section === "promo" && activeAdminNav === "sales-promotions-main") return "Ưu đãi bán hàng";
  if (section === "promo") return "Quản lý khuyến mãi";
  return "Cài đặt cửa hàng";
}

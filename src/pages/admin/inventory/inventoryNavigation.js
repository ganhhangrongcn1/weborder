export const INVENTORY_ROUTE_ITEMS = [
  {
    id: "inventory-dashboard",
    path: "/admin/inventory/dashboard",
    page: "dashboard",
    label: "Tổng quan kho",
    shortLabel: "Tổng quan",
    group: "Tổng quan",
    icon: "home",
    description: "Theo dõi mức sẵn sàng của dữ liệu và các luồng vận hành kho."
  },
  {
    id: "inventory-warehouses",
    path: "/admin/inventory/warehouses",
    page: "warehouses",
    label: "Kho",
    group: "Xây dữ liệu",
    icon: "store",
    description: "Quản lý kho trung tâm, kho chi nhánh và kho bộ phận."
  },
  {
    id: "inventory-items",
    path: "/admin/inventory/items",
    page: "items",
    label: "Nguyên vật liệu",
    group: "Xây dữ liệu",
    icon: "bag",
    description: "Danh mục nguyên vật liệu, bao bì, bán thành phẩm và thành phẩm."
  },
  {
    id: "inventory-item-categories",
    path: "/admin/inventory/item-categories",
    page: "item-categories",
    label: "Danh mục NVL",
    group: "Xây dữ liệu",
    icon: "folder",
    description: "Phân nhóm nguyên vật liệu để tìm kiếm và quản lý thuận tiện hơn."
  },
  {
    id: "inventory-units",
    path: "/admin/inventory/units",
    page: "units",
    label: "Đơn vị tính",
    group: "Xây dữ liệu",
    icon: "tag",
    description: "Đơn vị gốc, đơn vị mua và tỷ lệ quy đổi."
  },
  {
    id: "inventory-suppliers",
    path: "/admin/inventory/suppliers",
    page: "suppliers",
    label: "Nhà cung cấp",
    group: "Xây dữ liệu",
    icon: "user",
    description: "Nhà cung cấp và danh sách mặt hàng theo nhà cung cấp."
  },
  {
    id: "inventory-receipts",
    path: "/admin/inventory/receipts",
    page: "receipts",
    label: "Phiếu nhập kho",
    group: "Xuất nhập kho",
    icon: "download",
    description: "Lập phiếu nhận nguyên vật liệu vào kho theo quy trình gọn, dễ kiểm soát."
  },
  {
    id: "inventory-issues",
    path: "/admin/inventory/issues",
    page: "issues",
    label: "Phiếu xuất kho",
    group: "Xuất nhập kho",
    icon: "share",
    description: "Xuất dùng nội bộ, hao hụt hoặc hủy hàng với lý do rõ ràng."
  },
  {
    id: "inventory-transfers",
    path: "/admin/inventory/transfers",
    page: "transfers",
    label: "Chuyển kho nội bộ",
    group: "Xuất nhập kho",
    icon: "refresh",
    description: "Luân chuyển hàng giữa kho nguồn và kho nhận."
  },
  {
    id: "inventory-disposals",
    path: "/admin/inventory/disposals",
    page: "disposals",
    label: "Phiếu hủy",
    group: "Xuất nhập kho",
    icon: "trash",
    description: "Ghi nhận nguyên vật liệu hư hỏng, hết hạn, lãng phí, mất mát hoặc hao hụt."
  },
  {
    id: "inventory-requisitions",
    path: "/admin/inventory/requisitions",
    page: "requisitions",
    label: "Yêu cầu xuất kho",
    group: "Xuất nhập kho",
    icon: "bell",
    description: "Kho nhận gửi yêu cầu để kho nguồn xét duyệt và chuẩn bị hàng."
  },
  {
    id: "inventory-counts",
    path: "/admin/inventory/counts",
    page: "counts",
    label: "Kiểm kê",
    group: "Kiểm kê & đối soát",
    icon: "check",
    description: "Chốt số đếm thực tế và kiểm soát chênh lệch tồn."
  },
  {
    id: "inventory-adjustments",
    path: "/admin/inventory/adjustments",
    page: "adjustments",
    label: "Điều chỉnh tồn",
    group: "Kiểm kê & đối soát",
    icon: "edit",
    description: "Lập phiếu tăng hoặc giảm tồn có lý do và chờ quản lý duyệt."
  },
  {
    id: "inventory-ledger",
    path: "/admin/inventory/ledger",
    page: "ledger",
    label: "Sổ kho",
    group: "Báo cáo & cảnh báo",
    icon: "menu",
    description: "Tra cứu biến động tăng, giảm và số dư theo thời gian."
  },
  {
    id: "inventory-reports",
    path: "/admin/inventory/reports",
    page: "reports",
    label: "Tồn kho",
    group: "Báo cáo & cảnh báo",
    icon: "wallet",
    description: "Xem số lượng, giá vốn và giá trị tồn hiện tại theo từng kho."
  },
  {
    id: "inventory-lots",
    path: "/admin/inventory/lots",
    page: "lots",
    label: "Lô & hạn sử dụng",
    group: "Báo cáo & cảnh báo",
    icon: "clock",
    description: "Theo dõi số lượng còn lại và hạn sử dụng của từng lô hàng."
  },
  {
    id: "inventory-alerts",
    path: "/admin/inventory/alerts",
    page: "alerts",
    label: "Cảnh báo kho",
    group: "Báo cáo & cảnh báo",
    icon: "warning",
    description: "Tập trung các cảnh báo cần xử lý và mở thẳng tới đúng dữ liệu liên quan."
  },
  {
    id: "inventory-reconciliation",
    path: "/admin/inventory/reconciliation",
    page: "reconciliation",
    label: "Đối chiếu đơn ↔ kho",
    group: "Kiểm kê & đối soát",
    icon: "warning",
    description: "Đối chiếu đơn bán, định lượng và movement đã ghi nhận."
  },
  {
    id: "inventory-boms",
    path: "/admin/inventory/boms",
    page: "boms",
    label: "Công thức chế biến",
    group: "Sản xuất",
    icon: "menu",
    description: "Khai báo định mức sản xuất, đóng gói và sơ chế cho bán thành phẩm."
  },
  {
    id: "inventory-production-orders",
    path: "/admin/inventory/production-orders",
    page: "production-orders",
    label: "Lệnh sản xuất",
    group: "Sản xuất",
    icon: "gear",
    description: "Lập lệnh theo công thức, theo dõi thực hiện và cập nhật tồn kho khi hoàn thành."
  },
  {
    id: "inventory-sales-recipes",
    path: "/admin/inventory/sales-recipes",
    page: "sales-recipes",
    label: "Định lượng món bán",
    group: "Sản xuất",
    icon: "tag",
    description: "Định lượng món Menu và ánh xạ món từ các kênh bán."
  }
];

const INVENTORY_SECTION_DEFINITIONS = [
  {
    id: "inventory-master-data-section",
    title: "Xây dữ liệu",
    icon: "folder",
    pages: ["warehouses", "items", "item-categories", "units", "suppliers"]
  },
  {
    id: "inventory-operations-section",
    title: "Xuất nhập kho",
    icon: "refresh",
    pages: ["receipts", "issues", "transfers", "disposals", "requisitions"]
  },
  {
    id: "inventory-counting-section",
    title: "Kiểm kê & đối soát",
    icon: "check",
    pages: ["counts", "adjustments", "reconciliation"]
  },
  {
    id: "inventory-reporting-section",
    title: "Báo cáo & cảnh báo",
    icon: "warning",
    pages: ["reports", "lots", "alerts", "ledger"]
  },
  {
    id: "inventory-production-section",
    title: "Sản xuất & chế biến",
    icon: "gear",
    pages: ["boms", "production-orders", "sales-recipes"]
  }
];

export const INVENTORY_ROUTE_BY_PAGE = new Map(
  INVENTORY_ROUTE_ITEMS.map((item) => [item.page, item])
);

export const INVENTORY_NAV_SECTIONS = INVENTORY_SECTION_DEFINITIONS.map((section) => ({
  ...section,
  items: [
    ...(section.pages || []).map((page) => INVENTORY_ROUTE_BY_PAGE.get(page)).filter(Boolean),
    ...(section.plannedItems || [])
  ]
}));

export function getInventoryRoute(page = "dashboard") {
  return INVENTORY_ROUTE_BY_PAGE.get(page) || INVENTORY_ROUTE_BY_PAGE.get("dashboard");
}

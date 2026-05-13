export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=70";
export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 525;

export const DELIVERY_APP_OPTIONS = [
  { id: "grab", name: "GrabFood", active: true, url: "" },
  { id: "shopee", name: "ShopeeFood", active: true, url: "" },
  { id: "xanh-ngon", name: "Xanh Ngon", active: true, url: "" }
];

export const HOME_BLOCKS = [
  { id: "hero", title: "Banner đầu trang", placement: "Trang chủ / Banner lớn đầu trang" },
  { id: "deliveryApps", title: "Banner mua trên app", placement: "Trang chủ / Đặt qua ứng dụng giao hàng" },
  { id: "popupCampaign", title: "Popup trang chủ", placement: "Trang chủ / Popup sau khi tải trang" },
  { id: "fulfillment", title: "Khối giao hàng / tự đến lấy", placement: "Trang chủ / Chọn hình thức nhận hàng" },
  { id: "flashSale", title: "Khối Flash Sale", placement: "Trang chủ / Flash Sale" },
  { id: "categorySection", title: "Khối danh mục", placement: "Trang chủ / Danh mục" },
  { id: "featuredProducts", title: "Khối sản phẩm nổi bật", placement: "Trang chủ / Sản phẩm nổi bật" }
];

export const HOME_BLOCK_DEFAULTS = [
  { id: "deliveryApps", placement: "Trang chủ / Đặt qua ứng dụng giao hàng", title: "Đặt qua ứng dụng giao hàng", subtitle: "GrabFood, ShopeeFood, Xanh Ngon", active: true, branchApps: [] },
  {
    id: "popupCampaign",
    placement: "Trang chủ / Popup sau khi tải trang",
    title: "Popup khuyến mãi",
    subtitle: "Thông báo ưu đãi hoặc chiến dịch mới",
    active: false,
    delaySeconds: 3,
    cooldownHours: 6,
    image: "",
    actionType: "block",
    actionTarget: "home",
    actionUrl: ""
  },
  { id: "fulfillment", placement: "Trang chủ / Chọn hình thức nhận hàng", title: "Hình thức nhận hàng", active: true },
  { id: "flashSale", placement: "Trang chủ / Flash Sale", title: "Flash Sale", active: true },
  { id: "categorySection", placement: "Trang chủ / Danh mục", title: "Danh mục món", active: true },
  { id: "featuredProducts", placement: "Trang chủ / Sản phẩm nổi bật", title: "Sản phẩm nổi bật", active: true }
];

export const APP_SECTIONS = [
  { value: "home", label: "Trang chủ" },
  { value: "menu", label: "Menu" },
  { value: "checkout", label: "Thanh toán" },
  { value: "loyalty", label: "Ưu đãi / Loyalty" },
  { value: "account", label: "Tài khoản" },
  { value: "tracking", label: "Theo dõi đơn" }
];

export const HOME_SECTION_TARGETS = [
  { value: "home", label: "Trang chủ" },
  { value: "deliveryApps", label: "Block mua trên app" },
  { value: "fulfillment", label: "Block giao hàng / tự đến lấy" },
  { value: "flashSale", label: "Block Flash Sale" },
  { value: "categorySection", label: "Block danh mục" },
  { value: "featuredProducts", label: "Block sản phẩm nổi bật" },
  ...APP_SECTIONS.filter((item) => item.value !== "home")
];

export function isTopBannerItem(block) {
  const zone = String(block?.bannerZone || "").toLowerCase();
  const id = String(block?.id || "").toLowerCase();
  const placement = String(block?.placement || "").toLowerCase();
  return zone === "home-hero" || id === "hero" || placement.includes("banner lớn đầu trang");
}

export function normalizeAction(block) {
  if (block?.actionType === "url" || block?.actionType === "block") return block.actionType;
  if (block?.actionUrl) return "url";
  return "block";
}

function getBranchRawKey(branch, index) {
  return String(branch?.id || branch?.name || `branch-${index}`);
}

function getBranchAppKey(branch, index) {
  return `${getBranchRawKey(branch, index)}::${index}`;
}

export function buildDeliveryBranchApps(block, branches = []) {
  const sourceBranches = Array.isArray(branches) && branches.length
    ? branches
    : [{ id: "default", name: "Chi nhánh mặc định" }];
  const savedBranchApps = Array.isArray(block?.branchApps) ? block.branchApps : [];
  const rawKeyCounts = sourceBranches.reduce((counts, branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    counts[rawKey] = (counts[rawKey] || 0) + 1;
    return counts;
  }, {});

  return sourceBranches.map((branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    const branchId = getBranchAppKey(branch, index);
    const savedBranch =
      savedBranchApps.find((item) => String(item?.branchId || "") === branchId) ||
      (rawKeyCounts[rawKey] === 1 || index === 0
        ? savedBranchApps.find((item) => String(item?.branchId || "") === rawKey)
        : null) ||
      {};
    const savedApps = Array.isArray(savedBranch.apps) ? savedBranch.apps : [];

    return {
      branchId,
      branchSourceId: rawKey,
      branchName: branch?.name || savedBranch.branchName || "Chi nhánh",
      apps: DELIVERY_APP_OPTIONS.map((app) => {
        const savedApp = savedApps.find((item) => String(item?.id || "") === app.id || String(item?.name || "") === app.name);
        return {
          ...app,
          ...savedApp,
          id: app.id,
          name: savedApp?.name || app.name,
          active: savedApp?.active !== false
        };
      })
    };
  });
}

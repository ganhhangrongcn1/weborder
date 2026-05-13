import { products as productSeed } from "./products.js";

export const defaultHomeContent = [
  { id: "hero", placement: "Trang chủ / Banner lớn đầu trang", title: "Bánh tráng trộn", headline: "Ngon hết ý, giao liền tay!", subtitle: "Combo hot TikTok giảm đến 30%", cta: "Đặt món ngay", secondaryCta: "Mua lại", image: productSeed[0].image, active: true },
  { id: "cashback", placement: "Trang chủ / Thẻ xanh hoàn tiền", title: "Hoàn tiền 10.000đ", subtitle: "Cho các đơn đặt từ Grab, Shopee...", iconText: "%", active: true },
  { id: "deliveryApps", placement: "Trang chủ / Đặt qua ứng dụng giao hàng", title: "Đặt qua ứng dụng giao hàng", subtitle: "Chọn chi nhánh gần bạn rồi đặt qua app quen thuộc.", active: true, branchApps: [] },
  { id: "flashSale", placement: "Trang chủ / Banner cuối trang", title: "Combo xế chiều giảm 30%", headline: "Flash Sale", subtitle: "Mở bán 14:00 - 17:00 mỗi ngày", cta: "Săn ngay", active: true }
];

export const defaultSmartPromotions = [
  {
    id: "promo-freeship-150",
    name: "Freeship đơn từ 150k",
    type: "free_shipping",
    title: "Freeship 150k",
    text: "GHR hỗ trợ phí ship",
    icon: "bike",
    active: true,
    displayPlaces: ["home", "checkout"],
    condition: { minSubtotal: 150000, customerType: "all", productIds: "", categoryIds: "" },
    reward: { type: "shipping_discount", value: "full" },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 1
  },
  {
    id: "promo-gift-threshold",
    name: "Thêm món đạt quà",
    type: "gift_threshold",
    title: "Đủ mức nhận quà",
    text: "Tặng topping/trà xoài",
    icon: "gift",
    active: true,
    displayPlaces: ["checkout", "loyalty"],
    condition: { minSubtotal: 99000, customerType: "all", productIds: "", categoryIds: "" },
    reward: { type: "gift", value: "Topping hoặc trà xoài" },
    startAt: "2026-05-01",
    endAt: "2026-12-31",
    priority: 3
  }
];

export const promotionPlaces = [
  { id: "home", label: "Trang chủ" },
  { id: "menu", label: "Menu" },
  { id: "checkout", label: "Checkout" },
  { id: "loyalty", label: "Ưu đãi & Điểm" }
];

export const promotionTypes = [
  { id: "free_shipping", label: "Freeship tự động" },
  { id: "coupon_hint", label: "Mã giảm giá / gợi ý" },
  { id: "gift_threshold", label: "Đủ mức nhận quà" },
  { id: "happy_hour", label: "Giờ vàng" },
  { id: "repeat_order", label: "Mua lại đơn cũ" }
];

export const rewardTypes = [
  { id: "shipping_discount", label: "Hỗ trợ phí ship" },
  { id: "fixed_discount", label: "Giảm tiền cố định" },
  { id: "percent_discount", label: "Giảm theo %" },
  { id: "gift", label: "Tặng quà/món" },
  { id: "points", label: "Tặng điểm" }
];

export const defaultUserProfile = {
  name: "",
  phone: "",
  email: "",
  points: 0,
  totalOrders: 0,
  totalSpent: 0,
  memberRank: "Member",
  addresses: [],
  orderHistory: [],
  pointHistory: [],
  vouchers: [],
  checkinStreak: 0
};

export const defaultUserDemo = {
  name: "",
  phone: "",
  avatarUrl: "",
  passwordDemo: "",
  registered: false,
  createdAt: "",
  updatedAt: ""
};

export const defaultAddressesDemo = [];

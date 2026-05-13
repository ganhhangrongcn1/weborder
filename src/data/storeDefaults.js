import { products as productSeed } from "./products.js";

export const defaultHomeBanners = [
  {
    id: "hero",
    title: "B\u00e1nh tr\u00e1ng tr\u1ed9n",
    subtitle: "Combo hot TikTok gi\u1ea3m \u0111\u1ebfn 30%",
    active: true,
    image: productSeed[0].image
  },
  {
    id: "cashback",
    title: "Ho\u00e0n ti\u1ec1n 10.000\u0111",
    subtitle: "Cho \u0111\u01a1n \u0111\u1eb7t qua app giao h\u00e0ng",
    active: true,
    image: ""
  }
];

export const defaultCoupons = [
  { id: "NEW10", code: "NEW10", value: 10000, minOrder: 0, expiry: "2026-05-30", active: true },
  { id: "GHR20", code: "GHR20", value: 20000, minOrder: 149000, expiry: "2026-06-15", active: true }
];

export const checkoutFallbackCoupons = [
  ...defaultCoupons,
  { id: "TEA15", code: "TEA15", value: 15000, minOrder: 79000, expiry: "2026-06-15", active: true }
];

export const defaultCampaigns = [
  {
    id: "tiktok",
    name: "Combo hot TikTok",
    content: "Gi\u1ea3m \u0111\u1ebfn 30% cho combo b\u00e1n ch\u1ea1y",
    image: productSeed[5].image,
    period: "01/05 - 15/05",
    active: true
  }
];

export const defaultBranches = [
  {
    id: "phu-hoa",
    name: "G\u00e1nh H\u00e0ng Rong - Ph\u00fa H\u00f2a",
    address: "227 \u0110\u01b0\u1eddng 30/4, P. Ph\u00fa H\u00f2a",
    phone: "0901 234 567",
    map: "https://maps.google.com",
    open: true
  },
  {
    id: "hiep-thanh",
    name: "G\u00e1nh H\u00e0ng Rong - Hi\u1ec7p Th\u00e0nh",
    address: "12 Nguy\u1ec5n V\u0103n Ti\u1ebft, P. Hi\u1ec7p Th\u00e0nh",
    phone: "0902 345 678",
    map: "https://maps.google.com",
    open: true
  }
];

export const defaultPickupBranches = [
  {
    id: "phu-hoa",
    name: "G\u00e1nh H\u00e0ng Rong - Ph\u00fa H\u00f2a",
    address: "227 \u0110\u01b0\u1eddng 30/4, P. Ph\u00fa H\u00f2a, TP. Th\u1ee7 D\u1ea7u M\u1ed9t",
    time: "M\u1edf c\u1eeda 09:00 - 21:30"
  },
  {
    id: "hiep-thanh",
    name: "G\u00e1nh H\u00e0ng Rong - Hi\u1ec7p Th\u00e0nh",
    address: "12 Nguy\u1ec5n V\u0103n Ti\u1ebft, P. Hi\u1ec7p Th\u00e0nh, B\u00ecnh D\u01b0\u01a1ng",
    time: "M\u1edf c\u1eeda 10:00 - 22:00"
  }
];

export const defaultStoreHours = [
  "Th\u1ee9 2 - Th\u1ee9 6: 09:00 - 21:30",
  "Th\u1ee9 7 - CN: 10:00 - 22:00"
];

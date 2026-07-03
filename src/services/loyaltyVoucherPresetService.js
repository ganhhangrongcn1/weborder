const LOYALTY_VOUCHER_PRESET_ROWS = [
  {
    tierId: "new_customer",
    code: "CHOMGHIEN10",
    name: "Quà Chớm Ghiền",
    discountType: "fixed",
    value: 10000,
    minOrder: 49000,
    maxDiscount: 0,
    validDays: 14,
    autoGrantRecommended: false,
    note: "Hợp làm quà chào sân hoặc tặng tay trong CRM."
  },
  {
    tierId: "returning_customer",
    code: "GHIENNHE12",
    name: "Quà Ghiền Nhẹ",
    discountType: "fixed",
    value: 12000,
    minOrder: 59000,
    maxDiscount: 0,
    validDays: 21,
    autoGrantRecommended: true,
    note: "Mức đầu dễ chạm, nên cho quà nhỏ để khách có động lực quay lại."
  },
  {
    tierId: "super_fan",
    code: "GHIENTHIET15",
    name: "Quà Ghiền Thiệt",
    discountType: "fixed",
    value: 15000,
    minOrder: 69000,
    maxDiscount: 0,
    validDays: 30,
    autoGrantRecommended: true,
    note: "Mốc giữa nên đủ rõ để khách thấy mình được ghi nhận."
  },
  {
    tierId: "inner_circle_fan",
    code: "GHIENCHINH20",
    name: "Quà Ghiền Chính Hiệu",
    discountType: "fixed",
    value: 20000,
    minOrder: 89000,
    maxDiscount: 0,
    validDays: 30,
    autoGrantRecommended: true,
    note: "Dành cho nhóm đã mua đều, có thể dùng để kéo đơn giá trị cao hơn."
  },
  {
    tierId: "ganh_legend",
    code: "HUYENTHOAI30",
    name: "Quà Huyền Thoại Gánh",
    discountType: "fixed",
    value: 30000,
    minOrder: 119000,
    maxDiscount: 0,
    validDays: 45,
    autoGrantRecommended: true,
    note: "Giữ cảm giác đặc quyền nhưng vẫn dễ vận hành và dễ đối soát."
  }
];

function normalizeCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

export const LOYALTY_VOUCHER_PRESETS = LOYALTY_VOUCHER_PRESET_ROWS.map((item) => ({ ...item }));

export function getLoyaltyVoucherPresetByTierId(tierId = "") {
  return LOYALTY_VOUCHER_PRESETS.find((item) => item.tierId === String(tierId || "").trim()) || null;
}

export function buildLoyaltyPresetCoupon(preset) {
  const safePreset = preset || {};
  const validDaysAfterGrant = Number(safePreset.validDays || 30);
  return {
    id: `coupon-${safePreset.code || Date.now()}`,
    code: normalizeCode(safePreset.code),
    name: String(safePreset.name || "Voucher loyalty mẫu"),
    discountType: safePreset.discountType === "percent" ? "percent" : "fixed",
    value: Number(safePreset.value || 0),
    maxDiscount: Number(safePreset.maxDiscount || 0),
    minOrder: Number(safePreset.minOrder || 0),
    startAt: "",
    endAt: "",
    customerType: "all",
    usageLimit: 0,
    perUserLimit: 1,
    totalUsed: 0,
    voucherType: "loyalty",
    validDaysAfterGrant,
    fulfillmentType: "all",
    scopeType: "all",
    scopeValues: "",
    salesChannels: ["web", "qr"],
    stackable: false,
    active: true,
    expiry: ""
  };
}

export function applyLoyaltyVoucherPresets(coupons = []) {
  const safeCoupons = Array.isArray(coupons) ? [...coupons] : [];
  const existingCodes = new Set(
    safeCoupons.map((coupon) => normalizeCode(coupon?.code)).filter(Boolean)
  );
  const created = [];

  LOYALTY_VOUCHER_PRESETS.forEach((preset) => {
    if (existingCodes.has(normalizeCode(preset.code))) return;
    const coupon = buildLoyaltyPresetCoupon(preset);
    created.push(coupon);
    safeCoupons.unshift(coupon);
    existingCodes.add(normalizeCode(coupon.code));
  });

  return {
    coupons: safeCoupons,
    created,
    createdCount: created.length,
    skippedCount: LOYALTY_VOUCHER_PRESETS.length - created.length
  };
}

export function findAssignedLoyaltyVoucher(tier = {}, coupons = []) {
  const safeCoupons = Array.isArray(coupons) ? coupons : [];
  const target = String(tier?.milestoneVoucherId || "").trim();
  if (!target) return null;

  return safeCoupons.find((coupon) => (
    String(coupon?.id || "").trim() === target ||
    normalizeCode(coupon?.code) === normalizeCode(target)
  )) || null;
}

export function buildLoyaltyVoucherChecklist(tiers = [], coupons = []) {
  return (Array.isArray(tiers) ? tiers : []).map((tier) => {
    const preset = getLoyaltyVoucherPresetByTierId(tier?.id);
    const assignedCoupon = findAssignedLoyaltyVoucher(tier, coupons);
    const inactive = assignedCoupon ? assignedCoupon.active === false : false;

    let status = "missing";
    if (!tier?.milestoneVoucherId && preset?.autoGrantRecommended === false) {
      status = "optional";
    } else if (assignedCoupon && !inactive) {
      status = "ready";
    } else if (assignedCoupon && inactive) {
      status = "inactive";
    }

    return {
      tier,
      preset,
      assignedCoupon,
      status
    };
  });
}

export default {
  LOYALTY_VOUCHER_PRESETS,
  applyLoyaltyVoucherPresets,
  buildLoyaltyPresetCoupon,
  buildLoyaltyVoucherChecklist,
  findAssignedLoyaltyVoucher,
  getLoyaltyVoucherPresetByTierId
};

import { getCouponVoucherType } from "./voucherTemplateService.js";

export const COUPON_MANAGEMENT_GROUPS = [
  {
    value: "checkout_sales",
    label: "Voucher bán hàng",
    description: "Dùng cho checkout, mã giảm giá thường và các đợt bán hàng.",
    voucherType: "checkout"
  },
  {
    value: "loyalty_auto",
    label: "Loyalty tự động",
    description: "Tự tặng cho khách mới hoặc theo hạng thành viên.",
    voucherType: "loyalty"
  },
  {
    value: "loyalty_crm",
    label: "CRM / chiến dịch riêng",
    description: "Để tặng tay trong CRM, tri ân khách lâu chưa quay lại hoặc event.",
    voucherType: "loyalty"
  }
];

const GROUP_BY_VALUE = new Map(
  COUPON_MANAGEMENT_GROUPS.map((group) => [group.value, group])
);

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeGroupValue(value = "") {
  const key = normalizeText(value);
  return GROUP_BY_VALUE.has(key) ? key : "";
}

function buildAssignedVoucherRefSet(loyaltyConfig = {}) {
  const refs = new Set();
  const welcomeVoucherId = normalizeText(loyaltyConfig?.welcomeVoucherId);
  if (welcomeVoucherId) refs.add(welcomeVoucherId);

  (Array.isArray(loyaltyConfig?.tiers) ? loyaltyConfig.tiers : []).forEach((tier) => {
    const milestoneVoucherId = normalizeText(tier?.milestoneVoucherId);
    if (milestoneVoucherId) refs.add(milestoneVoucherId);
  });

  return refs;
}

function matchesAssignedVoucher(coupon = {}, assignedRefs = new Set()) {
  const id = normalizeText(coupon?.id);
  const code = normalizeText(coupon?.code).toUpperCase();
  return (id && assignedRefs.has(id)) || (code && assignedRefs.has(code));
}

export function getCouponManagementGroupDefinition(value = "") {
  return GROUP_BY_VALUE.get(normalizeGroupValue(value)) || COUPON_MANAGEMENT_GROUPS[0];
}

export function listCouponManagementGroupsForVoucherType(voucherType = "checkout") {
  const normalizedVoucherType = getCouponVoucherType({ voucherType });
  return COUPON_MANAGEMENT_GROUPS.filter((group) => group.voucherType === normalizedVoucherType);
}

export function getCouponManagementGroup(coupon = {}, loyaltyConfig = {}, preferredGroup = "") {
  const voucherType = getCouponVoucherType(coupon);
  if (voucherType !== "loyalty") return "checkout_sales";

  const assignedRefs = buildAssignedVoucherRefSet(loyaltyConfig);
  if (matchesAssignedVoucher(coupon, assignedRefs)) return "loyalty_auto";

  const explicitGroup = normalizeGroupValue(preferredGroup || coupon?.managementGroup);
  if (explicitGroup === "loyalty_auto" || explicitGroup === "loyalty_crm") {
    return explicitGroup;
  }

  return "loyalty_crm";
}

export function normalizeCouponManagementGroup(coupon = {}, loyaltyConfig = {}, preferredGroup = "") {
  return getCouponManagementGroup(coupon, loyaltyConfig, preferredGroup);
}

export function isCouponManualCrmVoucher(coupon = {}, loyaltyConfig = {}) {
  if (getCouponVoucherType(coupon) !== "loyalty") return false;
  return getCouponManagementGroup(coupon, loyaltyConfig) === "loyalty_crm";
}

export function listCrmGiftableCoupons(coupons = [], loyaltyConfig = {}) {
  return (Array.isArray(coupons) ? coupons : [])
    .filter((coupon) => coupon?.active !== false && isCouponManualCrmVoucher(coupon, loyaltyConfig))
    .sort((a, b) => String(a?.code || "").localeCompare(String(b?.code || "")));
}

export default {
  COUPON_MANAGEMENT_GROUPS,
  getCouponManagementGroup,
  getCouponManagementGroupDefinition,
  isCouponManualCrmVoucher,
  listCrmGiftableCoupons,
  listCouponManagementGroupsForVoucherType,
  normalizeCouponManagementGroup
};

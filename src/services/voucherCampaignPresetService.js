export const VOUCHER_CAMPAIGN_AUDIENCES = [
  { value: "all", label: "Tất cả khách phù hợp" },
  { value: "new_member", label: "Khách mới đăng ký" },
  { value: "tier_member", label: "Khách theo hạng thành viên" },
  { value: "winback_7d", label: "Khách chưa quay lại 7 ngày" },
  { value: "winback_15d", label: "Khách chưa quay lại 15 ngày" },
  { value: "birthday", label: "Khách sinh nhật" },
  { value: "event_special", label: "Khách thuộc event / chiến dịch riêng" }
];

export const VOUCHER_SETUP_PRESETS = [
  {
    value: "checkout_flash_sale",
    managementGroup: "checkout_sales",
    label: "Bán hàng nhanh",
    note: "Dùng cho flash sale, kéo đơn nhanh trong ngày.",
    code: "SALE10",
    name: "Voucher bán hàng",
    discountType: "fixed",
    valueAmount: 10000,
    minOrder: 0,
    salesChannels: ["web", "qr"],
    campaignType: "checkout_flash_sale",
    campaignAudience: "all",
    campaignLabel: "Flash sale"
  },
  {
    value: "checkout_combo_push",
    managementGroup: "checkout_sales",
    label: "Đẩy món / combo mới",
    note: "Dùng khi cần kích món mới hoặc chương trình bán kèm.",
    code: "COMBO15",
    name: "Voucher đẩy combo",
    discountType: "percent",
    valueAmount: 15,
    maxDiscount: 30000,
    minOrder: 99000,
    salesChannels: ["web", "qr"],
    campaignType: "checkout_combo_push",
    campaignAudience: "all",
    campaignLabel: "Đẩy combo mới"
  },
  {
    value: "loyalty_welcome_auto",
    managementGroup: "loyalty_auto",
    label: "Chào thành viên mới",
    note: "Gắn vào auto welcome voucher cho khách mới đăng ký.",
    code: "CHAOBANMOI",
    name: "Voucher chào thành viên mới",
    discountType: "fixed",
    valueAmount: 15000,
    minOrder: 0,
    validDaysAfterGrant: 7,
    salesChannels: ["web", "qr"],
    campaignType: "loyalty_welcome_auto",
    campaignAudience: "new_member",
    campaignLabel: "Chào thành viên mới"
  },
  {
    value: "loyalty_tier_auto",
    managementGroup: "loyalty_auto",
    label: "Quà theo hạng",
    note: "Dùng cho quà tháng của hạng thành viên.",
    code: "HANGTHANHVIEN",
    name: "Voucher quà theo hạng",
    discountType: "fixed",
    valueAmount: 20000,
    minOrder: 0,
    validDaysAfterGrant: 14,
    salesChannels: ["web", "qr"],
    campaignType: "loyalty_tier_auto",
    campaignAudience: "tier_member",
    campaignLabel: "Quà theo hạng"
  },
  {
    value: "crm_winback_7d",
    managementGroup: "loyalty_crm",
    label: "Kéo lại khách 7 ngày",
    note: "Voucher CRM cho khách 7 ngày chưa quay lại.",
    code: "QUAYLAI7NGAY",
    name: "Voucher quay lại 7 ngày",
    discountType: "fixed",
    valueAmount: 20000,
    minOrder: 99000,
    validDaysAfterGrant: 7,
    salesChannels: ["web", "qr"],
    campaignType: "crm_winback_7d",
    campaignAudience: "winback_7d",
    campaignLabel: "Kéo lại khách 7 ngày"
  },
  {
    value: "crm_winback_15d",
    managementGroup: "loyalty_crm",
    label: "Kéo lại khách 15 ngày",
    note: "Voucher CRM cho khách 15 ngày chưa quay lại.",
    code: "QUAYLAI15NGAY",
    name: "Voucher quay lại 15 ngày",
    discountType: "fixed",
    valueAmount: 30000,
    minOrder: 149000,
    validDaysAfterGrant: 10,
    salesChannels: ["web", "qr"],
    campaignType: "crm_winback_15d",
    campaignAudience: "winback_15d",
    campaignLabel: "Kéo lại khách 15 ngày"
  },
  {
    value: "crm_event_thank_you",
    managementGroup: "loyalty_crm",
    label: "Tri ân / event",
    note: "Tặng tay cho mini game, event, tri ân khách thân thiết.",
    code: "TRIAN",
    name: "Voucher tri ân khách hàng",
    discountType: "percent",
    valueAmount: 20,
    maxDiscount: 40000,
    minOrder: 99000,
    validDaysAfterGrant: 14,
    salesChannels: ["web", "qr"],
    campaignType: "crm_event_thank_you",
    campaignAudience: "event_special",
    campaignLabel: "Tri ân / event"
  }
];

const PRESET_BY_VALUE = new Map(
  VOUCHER_SETUP_PRESETS.map((preset) => [preset.value, preset])
);

const AUDIENCE_BY_VALUE = new Map(
  VOUCHER_CAMPAIGN_AUDIENCES.map((audience) => [audience.value, audience])
);

function normalizeText(value = "") {
  return String(value || "").trim();
}

export function getVoucherAudienceDefinition(value = "") {
  return AUDIENCE_BY_VALUE.get(normalizeText(value)) || VOUCHER_CAMPAIGN_AUDIENCES[0];
}

export function getVoucherSetupPresetDefinition(value = "") {
  return PRESET_BY_VALUE.get(normalizeText(value)) || null;
}

export function listVoucherSetupPresetsForGroup(managementGroup = "") {
  return VOUCHER_SETUP_PRESETS.filter((preset) => preset.managementGroup === normalizeText(managementGroup));
}

export function buildCouponFromSetupPreset(presetValue = "", timestamp = Date.now()) {
  const preset = getVoucherSetupPresetDefinition(presetValue);
  if (!preset) return null;

  const voucherType = preset.managementGroup === "checkout_sales" ? "checkout" : "loyalty";

  return {
    id: `coupon-${timestamp}`,
    code: preset.code,
    name: preset.name,
    discountType: preset.discountType,
    value: Number(preset.valueAmount || 0),
    maxDiscount: Number(preset.maxDiscount || 0),
    minOrder: Number(preset.minOrder || 0),
    endAt: "",
    voucherType,
    managementGroup: preset.managementGroup,
    validDaysAfterGrant: voucherType === "loyalty" ? Number(preset.validDaysAfterGrant || 7) : 0,
    salesChannels: Array.isArray(preset.salesChannels) ? preset.salesChannels : ["web", "qr"],
    usageLimit: 0,
    perUserLimit: 1,
    totalUsed: 0,
    active: true,
    campaignType: preset.value,
    campaignAudience: preset.campaignAudience || "all",
    campaignLabel: preset.campaignLabel || preset.name
  };
}

export default {
  buildCouponFromSetupPreset,
  getVoucherAudienceDefinition,
  getVoucherSetupPresetDefinition,
  listVoucherSetupPresetsForGroup,
  VOUCHER_CAMPAIGN_AUDIENCES,
  VOUCHER_SETUP_PRESETS
};

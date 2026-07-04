import { createRuntimeAppConfigRepository } from "./repositories/appConfigRepository.js";

export const CRM_CAMPAIGN_PRESETS_KEY = "ghr_crm_campaign_presets";
export const CRM_BULK_GIFT_HISTORY_KEY = "ghr_crm_bulk_gift_history";
const HISTORY_LIMIT = 30;

export const DEFAULT_CRM_CAMPAIGN_PRESETS = [
  {
    id: "crm_new_member_first_order",
    label: "Khách mới chưa có đơn",
    description: "Lọc khách đã đăng ký nhưng chưa phát sinh đơn đầu tiên.",
    filterValue: "new_member",
    audience: "new_member",
    tone: "new"
  },
  {
    id: "crm_tier_member_thank_you",
    label: "Khách có hạng thành viên",
    description: "Dành cho nhóm khách đã lên hạng để tri ân hoặc giữ chân.",
    filterValue: "tier_member",
    audience: "tier_member",
    tone: "tier"
  },
  {
    id: "crm_winback_7d",
    label: "Kéo lại khách 7 ngày",
    description: "Nhóm khách có đơn nhưng 7 ngày chưa quay lại.",
    filterValue: "inactive7",
    audience: "winback_7d",
    tone: "follow"
  },
  {
    id: "crm_winback_15d",
    label: "Kéo lại khách 15 ngày",
    description: "Nhóm khách 15 ngày chưa quay lại, cần ưu đãi mạnh hơn.",
    filterValue: "inactive15",
    audience: "winback_15d",
    tone: "care"
  },
  {
    id: "crm_winback_30d",
    label: "Cần chăm sóc 30 ngày",
    description: "Nhóm khách lâu chưa quay lại để gọi lại hoặc tặng ưu đãi riêng.",
    filterValue: "inactive30",
    audience: "winback_15d",
    tone: "care"
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizePhones(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((phone) => normalizeText(phone))
      .filter(Boolean)
  ));
}

function normalizeCampaignPreset(preset = {}, fallback = {}) {
  return {
    id: normalizeText(preset.id || fallback.id),
    label: normalizeText(preset.label || fallback.label),
    description: normalizeText(preset.description || fallback.description),
    filterValue: normalizeText(preset.filterValue || fallback.filterValue || "all"),
    audience: normalizeText(preset.audience || fallback.audience || "all"),
    tone: normalizeText(preset.tone || fallback.tone || "default")
  };
}

function normalizeCampaignPresetList(value) {
  const rawItems = Array.isArray(value) ? value : [];
  const providedById = new Map(
    rawItems
      .filter((item) => item && typeof item === "object")
      .map((item) => [normalizeText(item.id), item])
      .filter(([id]) => id)
  );

  const merged = DEFAULT_CRM_CAMPAIGN_PRESETS.map((preset) => (
    normalizeCampaignPreset(providedById.get(preset.id) || preset, preset)
  ));

  const extras = rawItems
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeCampaignPreset(item))
    .filter((item) => item.id && !merged.some((preset) => preset.id === item.id));

  return [...merged, ...extras];
}

function normalizeBulkGiftHistoryEntry(entry = {}) {
  const createdAt = normalizeText(entry.createdAt || new Date().toISOString());
  const successPhones = normalizePhones(entry.successPhones);
  const failedPhones = normalizePhones(entry.failedPhones);
  const duplicatePhones = normalizePhones(entry.duplicatePhones);
  const unregisteredPhones = normalizePhones(entry.unregisteredPhones);

  return {
    id: normalizeText(entry.id || `crm-bulk-${Date.now()}`),
    createdAt,
    campaignKey: normalizeText(entry.campaignKey),
    campaignLabel: normalizeText(entry.campaignLabel || "Tặng theo bộ lọc CRM"),
    filterValue: normalizeText(entry.filterValue || "all"),
    audience: normalizeText(entry.audience || "all"),
    voucherId: normalizeText(entry.voucherId),
    voucherCode: normalizeText(entry.voucherCode),
    voucherName: normalizeText(entry.voucherName || "Voucher CRM"),
    sourceType: normalizeText(entry.sourceType || "crm_bulk"),
    sourceLabel: normalizeText(entry.sourceLabel || "CRM - gửi theo nhóm"),
    totalRecipients: Math.max(0, Number(entry.totalRecipients || successPhones.length + failedPhones.length)),
    successCount: Math.max(0, Number(entry.successCount || successPhones.length)),
    failedCount: Math.max(0, Number(entry.failedCount || failedPhones.length)),
    duplicateCount: Math.max(0, Number(entry.duplicateCount || duplicatePhones.length)),
    unregisteredCount: Math.max(0, Number(entry.unregisteredCount || unregisteredPhones.length)),
    successPhones,
    failedPhones,
    duplicatePhones,
    unregisteredPhones
  };
}

function normalizeBulkGiftHistoryList(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeBulkGiftHistoryEntry(item))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, HISTORY_LIMIT);
}

export function createCrmCampaignService(repository = createRuntimeAppConfigRepository()) {
  return {
    getCampaignPresets() {
      return normalizeCampaignPresetList(repository.get(CRM_CAMPAIGN_PRESETS_KEY, clone(DEFAULT_CRM_CAMPAIGN_PRESETS)));
    },
    saveCampaignPresets(presets = []) {
      return repository.set(CRM_CAMPAIGN_PRESETS_KEY, normalizeCampaignPresetList(presets));
    },
    async getCampaignPresetsAsync() {
      return normalizeCampaignPresetList(await repository.getAsync(CRM_CAMPAIGN_PRESETS_KEY, clone(DEFAULT_CRM_CAMPAIGN_PRESETS)));
    },
    async saveCampaignPresetsAsync(presets = []) {
      return repository.setAsync(CRM_CAMPAIGN_PRESETS_KEY, normalizeCampaignPresetList(presets));
    },
    getBulkGiftHistory() {
      return normalizeBulkGiftHistoryList(repository.get(CRM_BULK_GIFT_HISTORY_KEY, []));
    },
    async getBulkGiftHistoryAsync() {
      return normalizeBulkGiftHistoryList(await repository.getAsync(CRM_BULK_GIFT_HISTORY_KEY, []));
    },
    async appendBulkGiftHistoryAsync(entry = {}) {
      const current = normalizeBulkGiftHistoryList(await repository.getAsync(CRM_BULK_GIFT_HISTORY_KEY, []));
      const nextEntry = normalizeBulkGiftHistoryEntry(entry);
      const next = normalizeBulkGiftHistoryList([nextEntry, ...current]);
      await repository.setAsync(CRM_BULK_GIFT_HISTORY_KEY, next);
      return nextEntry;
    }
  };
}

const crmCampaignService = createCrmCampaignService();

export const {
  getCampaignPresets,
  saveCampaignPresets,
  getCampaignPresetsAsync,
  saveCampaignPresetsAsync,
  getBulkGiftHistory,
  getBulkGiftHistoryAsync,
  appendBulkGiftHistoryAsync
} = crmCampaignService;

export default crmCampaignService;

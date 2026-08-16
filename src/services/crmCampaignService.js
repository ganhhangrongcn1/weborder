import { createRuntimeAppConfigRepository } from "./repositories/appConfigRepository.js";

export const CRM_CAMPAIGN_PRESETS_KEY = "ghr_crm_campaign_presets";
export const CRM_BULK_GIFT_HISTORY_KEY = "ghr_crm_bulk_gift_history";
export const CRM_CAMPAIGNS_KEY = "ghr_crm_campaigns";
const HISTORY_LIMIT = 30;
const CAMPAIGN_LIMIT = 100;

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

function normalizeCampaignRecord(record = {}) {
  const now = new Date().toISOString();
  const status = ["draft", "scheduled", "paused", "completed"].includes(normalizeText(record.status))
    ? normalizeText(record.status)
    : "draft";

  return {
    id: normalizeText(record.id || `crm-campaign-${Date.now()}`),
    name: normalizeText(record.name || record.label || "Chiến dịch voucher"),
    description: normalizeText(record.description),
    objective: normalizeText(record.objective || "custom"),
    objectiveLabel: normalizeText(record.objectiveLabel || record.name || record.label || "Nhóm khách đã chọn"),
    filterValue: normalizeText(record.filterValue || "all"),
    audience: normalizeText(record.audience || "all"),
    tone: normalizeText(record.tone || "default"),
    branchScope: normalizeText(record.branchScope || "all"),
    voucherId: normalizeText(record.voucherId),
    voucherCode: normalizeText(record.voucherCode),
    voucherName: normalizeText(record.voucherName),
    plannedAt: normalizeText(record.plannedAt),
    expiresAt: normalizeText(record.expiresAt),
    status,
    createdAt: normalizeText(record.createdAt || now),
    updatedAt: normalizeText(record.updatedAt || now),
    lastRunAt: normalizeText(record.lastRunAt),
    runCount: Math.max(0, Number(record.runCount || 0)),
    totalRecipients: Math.max(0, Number(record.totalRecipients || 0)),
    successCount: Math.max(0, Number(record.successCount || 0)),
    duplicateCount: Math.max(0, Number(record.duplicateCount || 0)),
    failedCount: Math.max(0, Number(record.failedCount || 0))
  };
}

function normalizeCampaignList(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeCampaignRecord(item))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
    .slice(0, CAMPAIGN_LIMIT);
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
    grantBatchId: normalizeText(entry.grantBatchId),
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
  const getCampaignsAsync = async () => normalizeCampaignList(
    await repository.getAsync(CRM_CAMPAIGNS_KEY, [])
  );

  const saveCampaignsAsync = async (campaigns = []) => {
    const normalized = normalizeCampaignList(campaigns);
    await repository.setAsync(CRM_CAMPAIGNS_KEY, normalized);
    return normalized;
  };

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
    getCampaigns() {
      return normalizeCampaignList(repository.get(CRM_CAMPAIGNS_KEY, []));
    },
    getCampaignsAsync,
    saveCampaignsAsync,
    async upsertCampaignAsync(campaign = {}) {
      const current = await getCampaignsAsync();
      const existing = current.find((item) => item.id === normalizeText(campaign.id));
      const normalized = normalizeCampaignRecord({
        ...existing,
        ...campaign,
        updatedAt: new Date().toISOString()
      });
      const next = existing
        ? current.map((item) => item.id === normalized.id ? normalized : item)
        : [normalized, ...current];
      await saveCampaignsAsync(next);
      return normalized;
    },
    async setCampaignStatusAsync(campaignId, status) {
      const current = await getCampaignsAsync();
      const existing = current.find((item) => item.id === campaignId);
      if (!existing) return null;
      const updated = normalizeCampaignRecord({
        ...existing,
        status,
        updatedAt: new Date().toISOString()
      });
      await saveCampaignsAsync(current.map((item) => item.id === campaignId ? updated : item));
      return updated;
    },
    async deleteCampaignAsync(campaignId) {
      const current = await getCampaignsAsync();
      const next = current.filter((item) => item.id !== campaignId);
      await saveCampaignsAsync(next);
      return next;
    },
    async recordCampaignRunAsync(campaignId, result = {}) {
      const current = await getCampaignsAsync();
      const existing = current.find((item) => item.id === campaignId);
      if (!existing) return null;
      const updated = normalizeCampaignRecord({
        ...existing,
        status: "completed",
        updatedAt: new Date().toISOString(),
        lastRunAt: result.createdAt || new Date().toISOString(),
        runCount: Number(existing.runCount || 0) + 1,
        totalRecipients: Number(existing.totalRecipients || 0) + Number(result.totalRecipients || 0),
        successCount: Number(existing.successCount || 0) + Number(result.successCount || 0),
        duplicateCount: Number(existing.duplicateCount || 0) + Number(result.duplicateCount || 0),
        failedCount: Number(existing.failedCount || 0) + Number(result.failedCount || 0)
      });
      await saveCampaignsAsync(current.map((item) => item.id === campaignId ? updated : item));
      return updated;
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
  getCampaigns,
  getCampaignsAsync,
  saveCampaignsAsync,
  upsertCampaignAsync,
  setCampaignStatusAsync,
  deleteCampaignAsync,
  recordCampaignRunAsync,
  getBulkGiftHistory,
  getBulkGiftHistoryAsync,
  appendBulkGiftHistoryAsync
} = crmCampaignService;

export default crmCampaignService;

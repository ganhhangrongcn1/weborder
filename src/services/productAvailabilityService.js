import { expandBranchKeys, getBranchCandidates } from "./branchIdentityService.js";

export const PRODUCT_SALES_CHANNELS = [
  { id: "web", label: "Website đặt hàng", shortLabel: "Website" },
  { id: "qr", label: "QR tại quán", shortLabel: "QR" },
  { id: "pos", label: "POS tại quầy", shortLabel: "POS" }
];

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeIdList(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(toText)
        .filter(Boolean)
    )
  );
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeBranchChannels(value = {}) {
  const source = getObject(value);
  return Object.fromEntries(
    Object.entries(source)
      .map(([branchId, channels]) => [
        toText(branchId),
        normalizeIdList(channels)
          .map(normalizeChannel)
          .filter((channel) => PRODUCT_SALES_CHANNELS.some((item) => item.id === channel))
      ])
      .filter(([branchId]) => branchId)
  );
}

function normalizeChannel(value = "") {
  const channel = toText(value).toLowerCase();
  if (["qr_counter", "qr-counter", "counter_qr", "counter-qr"].includes(channel)) return "qr";
  if (["website", "weborder", "web_order", "online"].includes(channel)) return "web";
  if (channel === "pos") return "pos";
  return channel || "web";
}

export function getBranchAvailabilityValue(branch = {}, index = 0) {
  return toText(
    branch.branch_uuid ||
      branch.branchUuid ||
      branch.uuid ||
      branch.id ||
      branch.dbId ||
      branch.branch_code ||
      branch.branchCode ||
      branch.slug ||
      branch.name ||
      `branch-${index + 1}`
  );
}

export function normalizeProductAvailability(product = {}) {
  const availability = getObject(product.availability);
  const metadata = getObject(product.metadata);
  const metadataAvailability = getObject(metadata.availability);

  const branchIds = normalizeIdList(
    availability.branchIds ||
      availability.branches ||
      product.availableBranchIds ||
      product.branchIds ||
      metadataAvailability.branchIds ||
      []
  );

  const channels = normalizeIdList(
    availability.channels ||
      product.availableChannels ||
      product.salesChannels ||
      metadataAvailability.channels ||
      []
  ).map(normalizeChannel);

  const branchChannels = normalizeBranchChannels(
    availability.branchChannels ||
      availability.byBranch ||
      product.availableBranchChannels ||
      metadataAvailability.branchChannels ||
      {}
  );

  return {
    branchIds,
    channels: channels.filter((channel) => PRODUCT_SALES_CHANNELS.some((item) => item.id === channel)),
    branchChannels,
    hasBranchChannelMatrix: Object.keys(branchChannels).length > 0
  };
}

export function buildProductAvailabilityPatch({ branchIds = [], channels = [], branchChannels = {} } = {}) {
  const normalizedBranchChannels = normalizeBranchChannels(branchChannels);
  const matrixBranchIds = Object.entries(normalizedBranchChannels)
    .filter(([, allowedChannels]) => allowedChannels.length > 0)
    .map(([branchId]) => branchId);
  const matrixChannels = Array.from(new Set(Object.values(normalizedBranchChannels).flat()));

  return {
    branchIds: Object.keys(normalizedBranchChannels).length ? matrixBranchIds : normalizeIdList(branchIds),
    channels: Object.keys(normalizedBranchChannels).length
      ? matrixChannels
      : normalizeIdList(channels).map(normalizeChannel),
    ...(Object.keys(normalizedBranchChannels).length ? { branchChannels: normalizedBranchChannels } : {})
  };
}

export function buildBranchChannelMatrix(availabilityInput = {}, branches = []) {
  const availability = normalizeProductAvailability({ availability: availabilityInput });
  const allChannels = PRODUCT_SALES_CHANNELS.map((item) => item.id);

  return Object.fromEntries(
    (Array.isArray(branches) ? branches : []).map((branch, index) => {
      const branchId = getBranchAvailabilityValue(branch, index);
      if (availability.hasBranchChannelMatrix) {
        return [branchId, availability.branchChannels[branchId] || []];
      }
      const branchAllowed = !availability.branchIds.length || availability.branchIds.includes(branchId);
      const allowedChannels = availability.channels.length ? availability.channels : allChannels;
      return [branchId, branchAllowed ? allowedChannels : []];
    })
  );
}

function getContextBranchKeys({ branch = null, branchValue = "" } = {}) {
  const keys = [];
  if (branch) keys.push(...getBranchCandidates(branch));
  if (branchValue) keys.push(branchValue);
  return expandBranchKeys(keys).map((key) => key.toLowerCase());
}

export function isProductAvailableForContext(product = {}, context = {}) {
  if (product.visible === false || product.active === false) return false;

  const availability = normalizeProductAvailability(product);
  const channel = normalizeChannel(context.channel);

  if (availability.hasBranchChannelMatrix) {
    const contextBranchKeys = getContextBranchKeys(context);
    if (contextBranchKeys.length) {
      const matchingEntry = Object.entries(availability.branchChannels).find(([branchId]) => {
        const entryKeys = expandBranchKeys([branchId]).map((key) => key.toLowerCase());
        return entryKeys.some((entryKey) => contextBranchKeys.includes(entryKey));
      });
      return Boolean(matchingEntry?.[1]?.includes(channel));
    }
  }

  if (availability.channels.length && !availability.channels.includes(channel)) {
    return false;
  }

  if (!availability.branchIds.length) return true;

  const contextBranchKeys = getContextBranchKeys(context);
  if (!contextBranchKeys.length) return true;

  const allowedBranchKeys = expandBranchKeys(availability.branchIds).map((key) => key.toLowerCase());
  return allowedBranchKeys.some((allowedKey) => contextBranchKeys.includes(allowedKey));
}

export function filterProductsForAvailability(products = [], context = {}) {
  return (Array.isArray(products) ? products : []).filter((product) => isProductAvailableForContext(product, context));
}

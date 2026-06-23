import { expandBranchKeys, getBranchCandidates } from "./branchIdentityService.js";

export const PRODUCT_SALES_CHANNELS = [
  { id: "web", label: "Website đặt hàng" },
  { id: "qr", label: "QR tại quán" },
  { id: "pos", label: "POS tại quầy" }
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

  return {
    branchIds,
    channels: channels.filter((channel) => PRODUCT_SALES_CHANNELS.some((item) => item.id === channel))
  };
}

export function buildProductAvailabilityPatch({ branchIds = [], channels = [] } = {}) {
  return {
    branchIds: normalizeIdList(branchIds),
    channels: normalizeIdList(channels).map(normalizeChannel)
  };
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

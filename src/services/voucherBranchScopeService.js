import { getBranchCandidates, normalizeBranchKey } from "./branchIdentityService.js";

function toText(value = "") {
  return String(value || "").trim();
}

export function normalizeVoucherBranchUuids(value = []) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(toText).filter(Boolean)));
}

export function getVoucherBranchOptionId(branch = {}) {
  return toText(
    branch.branch_uuid ||
    branch.branchUuid ||
    branch.uuid ||
    branch.id ||
    branch.branch_code ||
    branch.branchCode ||
    branch.name
  );
}

export function getVoucherBranchOptionLabel(branch = {}, index = 0) {
  return toText(branch.name || branch.branch_name || branch.label || branch.address) || `Chi nhánh ${index + 1}`;
}

export function getVoucherBranchScopeLabel(coupon = {}, branches = []) {
  const selected = normalizeVoucherBranchUuids(coupon.branchUuids || coupon.branch_uuids);
  if (!selected.length) return "Tất cả chi nhánh";

  const selectedSet = new Set(selected.map(normalizeBranchKey));
  const labels = (Array.isArray(branches) ? branches : [])
    .filter((branch) => getBranchCandidates(branch).some((candidate) => selectedSet.has(normalizeBranchKey(candidate))))
    .map(getVoucherBranchOptionLabel);

  if (!labels.length) return `${selected.length} chi nhánh`;
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels.length} chi nhánh`;
}

export function isVoucherAllowedForBranch(coupon = {}, branchId = "", branches = []) {
  const allowed = normalizeVoucherBranchUuids(coupon.branchUuids || coupon.branch_uuids);
  if (!allowed.length) return true;

  const currentKey = normalizeBranchKey(branchId);
  if (!currentKey) return true;

  const currentBranch = (Array.isArray(branches) ? branches : []).find((branch) => (
    getBranchCandidates(branch).some((candidate) => normalizeBranchKey(candidate) === currentKey)
  ));
  const currentCandidates = [branchId, ...(currentBranch ? getBranchCandidates(currentBranch) : [])]
    .map(normalizeBranchKey)
    .filter(Boolean);
  const currentSet = new Set(currentCandidates);

  return allowed.some((candidate) => currentSet.has(normalizeBranchKey(candidate)));
}

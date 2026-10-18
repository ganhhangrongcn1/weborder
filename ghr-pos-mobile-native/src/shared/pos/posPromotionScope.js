export function isPromotionAllowedForBranch(promotion = {}, branchUuid = "") {
  const branchIds = promotion?.condition?.branchIds;
  if (branchIds == null) return true;
  if (!Array.isArray(branchIds)) return false;
  if (!branchIds.length) return true;
  const targetBranch = String(branchUuid || "").trim().toLowerCase();
  return Boolean(targetBranch) && branchIds.some((id) => (
    String(id || "").trim().toLowerCase() === targetBranch
  ));
}

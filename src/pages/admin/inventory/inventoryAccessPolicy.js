import {
  buildBranchFilterOptions,
  normalizeBranchKey
} from "../../../services/branchIdentityService.js";

function toText(value = "") {
  return String(value || "").trim();
}

function findAssignedBranchOption(branchUuid = "", branchOptions = []) {
  const targetKey = normalizeBranchKey(branchUuid);
  if (!targetKey) return null;

  return branchOptions.find((option) => {
    if (normalizeBranchKey(option.value) === targetKey) return true;
    return (option.aliases || []).some((alias) => normalizeBranchKey(alias) === targetKey);
  }) || null;
}

export function getInventoryAccessPolicy({
  adminProfile = null,
  isSupabaseAdminMode = false,
  branches = []
} = {}) {
  const allBranchOptions = buildBranchFilterOptions(branches);

  if (!isSupabaseAdminMode) {
    return {
      allowed: true,
      role: "local",
      scope: "global",
      scopeLabel: "Toàn hệ thống (local)",
      branchUuid: "",
      branchOptions: allBranchOptions,
      selectedBranchFilter: "all",
      branchSelectorLocked: false,
      canManageInventory: true,
      message: ""
    };
  }

  const role = toText(adminProfile?.role).toLowerCase();
  const branchUuid = toText(adminProfile?.branchUuid || adminProfile?.branch_uuid);
  const accountScope = toText(adminProfile?.metadata?.account_scope || adminProfile?.accountScope).toLowerCase();

  if (role === "admin" && !branchUuid) {
    return {
      allowed: true,
      role,
      scope: "global",
      scopeLabel: "Toàn hệ thống",
      branchUuid: "",
      branchOptions: allBranchOptions,
      selectedBranchFilter: "all",
      branchSelectorLocked: false,
      canManageInventory: true,
      message: ""
    };
  }

  if (["admin", "staff", "kitchen"].includes(role) && branchUuid) {
    const assignedOption = findAssignedBranchOption(branchUuid, allBranchOptions) || {
      value: branchUuid,
      label: toText(adminProfile?.branchName || adminProfile?.branch_name) || "Chi nhánh được giao",
      aliases: [branchUuid]
    };

    return {
      allowed: true,
      role,
      scope: "branch",
      scopeLabel: assignedOption.label,
      branchUuid,
      branchOptions: [assignedOption],
      selectedBranchFilter: assignedOption.value,
      branchSelectorLocked: true,
      canManageInventory: false,
      message: ""
    };
  }

  if (role === "staff" && !branchUuid && accountScope === "central_inventory") {
    return {
      allowed: true,
      role,
      scope: "warehouse",
      scopeLabel: "Kho Tổng và các kho chi nhánh",
      branchUuid: "",
      branchOptions: [],
      selectedBranchFilter: "",
      branchSelectorLocked: true,
      canManageInventory: true,
      message: ""
    };
  }

  const message = role === "kitchen"
    ? "Tài khoản bếp cần được gán chi nhánh trước khi mở Quản lý kho."
    : "Tài khoản cần vai trò Admin hoặc nhân viên đã được gán chi nhánh để mở Quản lý kho.";

  return {
    allowed: false,
    role,
    scope: "blocked",
    scopeLabel: "Chưa được cấp quyền",
    branchUuid,
    branchOptions: [],
    selectedBranchFilter: "",
    branchSelectorLocked: true,
    canManageInventory: false,
    message
  };
}

export function getInventoryScopedWarehouses(warehouses = [], accessPolicy = {}) {
  if (accessPolicy?.scope !== "branch") return warehouses;

  const allowedKeys = new Set([
    accessPolicy.branchUuid,
    accessPolicy.selectedBranchFilter,
    ...(accessPolicy.branchOptions || []).flatMap((option) => [option?.value, ...(option?.aliases || [])])
  ].map(normalizeBranchKey).filter(Boolean));

  if (!allowedKeys.size) return [];

  return warehouses.filter((warehouse) => [
    warehouse?.branchUuid,
    warehouse?.branch_uuid,
    warehouse?.branchId,
    warehouse?.branch_id
  ].some((value) => allowedKeys.has(normalizeBranchKey(value))));
}

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
      message: ""
    };
  }

  const role = toText(adminProfile?.role).toLowerCase();
  const branchUuid = toText(adminProfile?.branchUuid || adminProfile?.branch_uuid);

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
      message: ""
    };
  }

  if ((role === "admin" || role === "staff") && branchUuid) {
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
      message: ""
    };
  }

  const message = role === "kitchen"
    ? "Tài khoản bếp không được xem dữ liệu tồn kho."
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
    message
  };
}

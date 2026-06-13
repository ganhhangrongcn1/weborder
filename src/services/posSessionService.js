import { loginAdminWithPassword, logoutAdmin } from "./adminAuthService.js";
import { resolveBranchFromCandidates } from "./branchIdentityService.js";

const POS_SESSION_KEY = "ghr_pos_branch_session";
const POS_SESSION_VERSION = 2;

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeEmail(value = "") {
  return toText(value).toLowerCase();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getBranchValue(branch = {}, index = 0) {
  return toText(branch.branch_uuid || branch.branchUuid || branch.uuid || branch.id || branch.branch_code || branch.branchCode || `branch-${index}`);
}

function getBranchName(branch = {}) {
  return toText(branch.name) || "Chi nhánh";
}

function getProfileBranchCandidates(profile = {}) {
  const metadata = getObject(profile.metadata);
  return [
    profile.branchUuid,
    profile.branch_uuid,
    profile.branchName,
    profile.branch_name,
    profile.branchAlias,
    profile.branch_alias,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.branchName,
    metadata.branch_name,
    metadata.branchAlias,
    metadata.branch_alias,
    metadata.branchCode,
    metadata.branch_code,
    metadata.branchId,
    metadata.branch_id,
    profile.email,
    profile.name
  ].map(toText).filter(Boolean);
}

function normalizePosSession(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  if (Number(raw.version || 0) !== POS_SESSION_VERSION) return null;

  const branchValue = toText(raw.branchValue);
  const accountEmail = normalizeEmail(raw.accountEmail);
  if (!branchValue || !accountEmail) return null;

  return {
    version: POS_SESSION_VERSION,
    branchValue,
    branchName: toText(raw.branchName),
    cashierName: toText(raw.cashierName) || accountEmail,
    accountEmail,
    profileId: toText(raw.profileId),
    role: toText(raw.role),
    loggedInAt: toText(raw.loggedInAt) || new Date().toISOString()
  };
}

function buildSessionFromProfile({ profile = {}, branch = {}, branchIndex = 0 } = {}) {
  const email = normalizeEmail(profile.email);
  const displayName = toText(profile.name || profile.fullName || profile.full_name) || email;

  return normalizePosSession({
    version: POS_SESSION_VERSION,
    branchValue: getBranchValue(branch, branchIndex),
    branchName: getBranchName(branch),
    cashierName: displayName,
    accountEmail: email,
    profileId: toText(profile.id),
    role: toText(profile.role),
    loggedInAt: new Date().toISOString()
  });
}

export function readPosSession() {
  try {
    return normalizePosSession(JSON.parse(localStorage.getItem(POS_SESSION_KEY) || "null"));
  } catch (error) {
    return null;
  }
}

export async function clearPosSession() {
  localStorage.removeItem(POS_SESSION_KEY);
  await logoutAdmin().catch(() => {});
}

export async function loginPosAccount({ branches = [], email = "", password = "" } = {}) {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail || !password) {
    return {
      ok: false,
      message: "Vui lòng nhập email và mật khẩu POS."
    };
  }

  const authResult = await loginAdminWithPassword({ email: safeEmail, password });
  if (!authResult.ok) {
    return {
      ok: false,
      message: authResult.message || "Đăng nhập POS thất bại."
    };
  }

  const profile = authResult.profile || {};
  const matchedBranch = resolveBranchFromCandidates(getProfileBranchCandidates(profile), branches);
  if (!matchedBranch) {
    await logoutAdmin().catch(() => {});
    return {
      ok: false,
      message: "Tài khoản này chưa được gán đúng chi nhánh trong profiles."
    };
  }

  const branchIndex = (Array.isArray(branches) ? branches : []).findIndex((branch) => branch === matchedBranch);
  const session = buildSessionFromProfile({
    profile,
    branch: matchedBranch,
    branchIndex: branchIndex >= 0 ? branchIndex : 0
  });

  if (!session) {
    await logoutAdmin().catch(() => {});
    return {
      ok: false,
      message: "Không tạo được phiên POS cho tài khoản này."
    };
  }

  localStorage.setItem(POS_SESSION_KEY, JSON.stringify(session));
  return {
    ok: true,
    session
  };
}

export { getBranchValue };

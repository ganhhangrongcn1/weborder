import { supabase } from "../supabase/client";

const PROFILE_COLUMNS = "id,auth_user_id,phone,name,email,role,status,registered,branch_uuid,metadata";
const BRANCH_COLUMN_SETS = [
  "id,name,slug,branch_code,branch_uuid,legacy_id,data",
  "id,name,slug,branch_code,branch_uuid,data",
  "id,name,branch_uuid,data",
  "id,name,branch_uuid"
];

const mockProfile = {
  id: "local-profile",
  authUserId: "local-user",
  name: "Thu ngân POS",
  email: "pos@ghr.local",
  role: "staff",
  status: "active",
  branchUuid: "ghr-demo-branch",
  branchName: "Gánh Hàng Rong - Chi nhánh demo"
};

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeEmail(value = "") {
  return toText(value).toLowerCase();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeBranchKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/ganh\s*hang\s*rong/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function expandBranchKeys(values = []) {
  return values.flatMap((value) => {
    const raw = toText(value);
    const normalized = normalizeBranchKey(raw);
    return [raw, normalized].filter(Boolean);
  });
}

function getBranchCandidates(branch = {}) {
  const metadata = getObject(branch.data || branch.metadata);
  return [
    branch.branch_uuid,
    branch.branchUuid,
    branch.uuid,
    metadata.branch_uuid,
    metadata.branchUuid,
    metadata.uuid,
    branch.id,
    branch.legacy_id,
    metadata.id,
    metadata.legacy_id,
    branch.branch_code,
    branch.branchCode,
    metadata.branch_code,
    metadata.branchCode,
    branch.slug,
    metadata.slug,
    branch.name,
    metadata.name,
    branch.address,
    metadata.address
  ].map(toText).filter(Boolean);
}

function getProfileBranchCandidates(profile = {}) {
  const metadata = getObject(profile.metadata);
  return [
    profile.branchUuid,
    profile.branch_uuid,
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

function findBranchByMappedAlias(candidate = "", branches = []) {
  const normalized = normalizeBranchKey(candidate);
  if (!normalized) return null;

  const aliasTargets = [
    {
      aliases: ["phuhoa", "duong304", "duong30thang4", "304", "30thang4", "30t4"],
      targets: ["duong304", "duong30thang4", "304", "30thang4", "30t4", "cn01"]
    },
    {
      aliases: ["thichquangduc", "tqd"],
      targets: ["thichquangduc", "tqd", "cn02"]
    },
    {
      aliases: ["lehongphong", "lhp"],
      targets: ["lehongphong", "lhp", "cn03"]
    }
  ];

  const matchedAlias = aliasTargets.find((item) =>
    item.aliases.some((alias) => normalized.includes(alias))
  );
  if (!matchedAlias) return null;

  return (Array.isArray(branches) ? branches : []).find((branch) => {
    const branchText = getBranchCandidates(branch).map(normalizeBranchKey).join(" ");
    return matchedAlias.targets.some((target) => branchText.includes(target));
  }) || null;
}

function resolveBranchFromCandidates(candidates = [], branches = []) {
  const branchList = Array.isArray(branches) ? branches.filter(Boolean) : [];
  const candidateKeys = expandBranchKeys(candidates);
  if (!branchList.length || !candidateKeys.length) return null;

  for (const candidateKey of candidateKeys) {
    const matched = branchList.find((branch) => {
      const branchKeys = expandBranchKeys(getBranchCandidates(branch));
      return branchKeys.some((branchKey) => branchKey.toLowerCase() === candidateKey.toLowerCase());
    });
    if (matched) return matched;
  }

  for (const candidate of candidates) {
    const matchedAlias = findBranchByMappedAlias(candidate, branchList);
    if (matchedAlias) return matchedAlias;
  }

  return null;
}

function normalizeBranch(row = {}, index = 0) {
  const metadata = getObject(row.data || row.metadata);
  return {
    ...row,
    branchUuid: toText(row.branch_uuid || row.branchUuid || metadata.branch_uuid || metadata.branchUuid),
    branchCode: toText(row.branch_code || row.branchCode || metadata.branch_code || metadata.branchCode),
    slug: toText(row.slug || metadata.slug),
    name: toText(row.name || metadata.name) || `Chi nhánh ${index + 1}`,
    data: metadata
  };
}

function normalizeProfile(profile = null) {
  if (!profile || typeof profile !== "object") return null;
  const metadata = getObject(profile.metadata);
  return {
    ...profile,
    id: toText(profile.id),
    authUserId: toText(profile.auth_user_id || profile.authUserId),
    name: toText(profile.name),
    email: normalizeEmail(profile.email),
    role: toText(profile.role).toLowerCase(),
    status: toText(profile.status).toLowerCase(),
    branchUuid: toText(profile.branch_uuid || profile.branchUuid || metadata.branch_uuid || metadata.branchUuid),
    branchName: toText(metadata.branch_name || metadata.branchName),
    branchAlias: toText(metadata.branch_alias || metadata.branchAlias || metadata.branch_code || metadata.branchCode),
    metadata
  };
}

function applyBranch(profile = null, branch = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized) return null;
  if (!branch) return normalized;

  const normalizedBranch = normalizeBranch(branch);
  return {
    ...normalized,
    branchUuid: normalizedBranch.branchUuid || normalized.branchUuid,
    branchName: normalizedBranch.name || normalized.branchName,
    branchAlias: normalizedBranch.branchCode || normalizedBranch.slug || normalized.branchAlias,
    branch: normalizedBranch
  };
}

async function fetchBranches() {
  if (!supabase) return [];

  for (const columns of BRANCH_COLUMN_SETS) {
    const { data, error } = await supabase
      .from("branches")
      .select(columns)
      .order("name", { ascending: true });

    if (!error) {
      return (Array.isArray(data) ? data : []).map(normalizeBranch).filter((branch) => branch.branchUuid);
    }
  }

  return [];
}

async function enrichProfileBranch(profile = null) {
  const normalized = normalizeProfile(profile);
  if (!normalized || !supabase) return normalized;

  const branches = await fetchBranches();
  const matchedBranch = resolveBranchFromCandidates(getProfileBranchCandidates(normalized), branches);
  return applyBranch(normalized, matchedBranch);
}

async function readProfileBySession(session) {
  if (!supabase || !session?.user?.id) return null;

  const authUserId = toText(session.user.id);
  const email = normalizeEmail(session.user.email);

  let query = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!query.error && query.data) {
    return enrichProfileBranch(query.data);
  }

  query = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .ilike("email", email)
    .maybeSingle();

  if (query.error) {
    throw query.error;
  }
  return enrichProfileBranch(query.data);
}

async function clearLocalAuthSession() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Recovery path only: clear local auth state when refresh tokens are stale.
  }
}

export async function signInPosOperator({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");

  if (!cleanEmail || !cleanPassword) {
    return { ok: false, message: "Vui lòng nhập email và mật khẩu POS." };
  }

  if (!supabase) {
    return {
      ok: true,
      session: {
        user: {
          id: mockProfile.authUserId,
          email: cleanEmail
        }
      },
      profile: {
        ...mockProfile,
        email: cleanEmail
      },
      fallback: true
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword
  });

  if (error) {
    return { ok: false, message: error.message || "Đăng nhập POS thất bại." };
  }

  try {
    const profile = await readProfileBySession(data.session);
    if (!profile) {
      await clearLocalAuthSession();
      return { ok: false, message: "Tài khoản chưa có profile vận hành." };
    }

    if (!["admin", "staff", "kitchen"].includes(profile.role) || profile.status !== "active") {
      await clearLocalAuthSession();
      return { ok: false, message: "Tài khoản không có quyền POS hoặc chưa active." };
    }

    if (!profile.branchUuid) {
      await clearLocalAuthSession();
      return { ok: false, message: "Tài khoản này chưa được gán đúng chi nhánh trong profiles." };
    }

    return {
      ok: true,
      session: data.session,
      profile
    };
  } catch (errorProfile) {
    await clearLocalAuthSession();
    return {
      ok: false,
      message: errorProfile?.message || "Không đọc được profile vận hành."
    };
  }
}

export async function restorePosSession() {
  if (!supabase) {
    return {
      ok: false,
      session: null,
      profile: null,
      message: ""
    };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    if (error) {
      await clearLocalAuthSession();
    }
    return { ok: false, session: null, profile: null, message: error?.message || "" };
  }

  try {
    const profile = await readProfileBySession(data.session);
    if (!profile?.branchUuid) {
      await clearLocalAuthSession();
      return {
        ok: false,
        session: null,
        profile: null,
        message: "Không tìm thấy profile hoặc chi nhánh vận hành."
      };
    }
    return {
      ok: true,
      session: data.session,
      profile
    };
  } catch (profileError) {
    await clearLocalAuthSession();
    return {
      ok: false,
      session: null,
      profile: null,
      message: profileError?.message || "Không khôi phục được phiên POS."
    };
  }
}

export async function signOutPosOperator() {
  if (supabase) {
    await clearLocalAuthSession();
  }
  return {
    ok: true
  };
}

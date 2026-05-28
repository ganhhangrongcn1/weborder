function toText(value = "") {
  return String(value || "").trim();
}

export function normalizeBranchKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/ganh\s*hang\s*rong/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function getBranchCandidates(branch = {}) {
  const metadata = getObject(branch.data || branch.metadata);
  return [
    branch.branch_uuid,
    branch.branchUuid,
    branch.uuid,
    metadata.branch_uuid,
    metadata.branchUuid,
    metadata.uuid,
    branch.id,
    branch.dbId,
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

export function getOrderBranchCandidates(order = {}) {
  const raw = getObject(order.rawData || order.raw_data || order.raw);
  const metadata = getObject(order.metadata || raw.metadata);
  const branch = getObject(order.branch);

  return [
    order.branchUuid,
    order.branch_uuid,
    order.pickupBranchUuid,
    order.pickup_branch_uuid,
    order.deliveryBranchUuid,
    order.delivery_branch_uuid,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.pickupBranchUuid,
    metadata.pickup_branch_uuid,
    metadata.deliveryBranchUuid,
    metadata.delivery_branch_uuid,
    raw.branch_uuid,
    raw.pickup_branch_uuid,
    raw.delivery_branch_uuid,
    branch.branch_uuid,
    branch.branchUuid,
    branch.uuid,
    order.branchId,
    order.branch_id,
    order.pickupBranchId,
    order.pickup_branch_id,
    order.deliveryBranchId,
    order.delivery_branch_id,
    metadata.branchId,
    metadata.branch_id,
    raw.branch_id,
    raw.branch_code,
    raw.nexpos_site_id,
    raw.nexpos_hub_id,
    order.branchCode,
    order.branch_code,
    order.branchName,
    order.branch_name,
    order.pickupBranchName,
    order.pickup_branch_name,
    order.deliveryBranchName,
    order.delivery_branch_name,
    metadata.branchName,
    metadata.branch_name,
    raw.branch_name,
    raw.nexpos_site_name,
    raw.nexpos_hub_name,
    raw.store_name,
    raw.site_name,
    raw.hub_name,
    branch.name
  ].map(toText).filter(Boolean);
}

export function expandBranchKeys(values = []) {
  return values.flatMap((value) => {
    const raw = toText(value);
    const normalized = normalizeBranchKey(raw);
    return [raw, normalized].filter(Boolean);
  });
}

export function buildBranchLookupMap(branches = []) {
  const map = new Map();
  (Array.isArray(branches) ? branches : []).filter(Boolean).forEach((branch) => {
    const metadata = getObject(branch.data || branch.metadata);
    const branchUuid = toText(
      branch.branch_uuid ||
        branch.branchUuid ||
        branch.uuid ||
        metadata.branch_uuid ||
        metadata.branchUuid ||
        metadata.uuid
    );
    if (!branchUuid) return;
    expandBranchKeys(getBranchCandidates(branch)).forEach((key) => {
      if (!map.has(key)) map.set(key, branchUuid);
    });
  });
  return map;
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

  const matchedAlias = aliasTargets.find((item) => item.aliases.some((alias) => normalized.includes(alias)));
  if (!matchedAlias) return null;

  return (Array.isArray(branches) ? branches : []).find((branch) => {
    const branchText = getBranchCandidates(branch).map(normalizeBranchKey).join(" ");
    return matchedAlias.targets.some((target) => branchText.includes(target));
  }) || null;
}

export function resolveBranchFromCandidates(candidates = [], branches = []) {
  const branchList = Array.isArray(branches) ? branches.filter(Boolean) : [];
  if (!branchList.length) return null;

  const candidateKeys = expandBranchKeys(candidates);
  if (!candidateKeys.length) return null;

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

export function resolveOrderBranch(order = {}, branches = []) {
  return resolveBranchFromCandidates(getOrderBranchCandidates(order), branches);
}

export function getCanonicalOrderBranchName(order = {}, branches = []) {
  const matchedBranch = resolveOrderBranch(order, branches);
  return (
    matchedBranch?.name ||
    order.branchName ||
    order.pickupBranchName ||
    order.deliveryBranchName ||
    order.branch_name ||
    order.pickup_branch_name ||
    order.delivery_branch_name ||
    getObject(order.branch).name ||
    ""
  );
}

export function buildBranchFilterOptions(branches = []) {
  return (Array.isArray(branches) ? branches : [])
    .map((branch, index) => {
      const label = toText(branch?.name);
      if (!label) return null;
      const value = toText(branch?.branch_uuid || branch?.branchUuid || branch?.uuid || branch?.id || `branch-${index}`);
      return {
        value,
        label,
        aliases: expandBranchKeys(getBranchCandidates(branch))
      };
    })
    .filter(Boolean);
}

export function branchOptionMatchesOrder(order = {}, branchOption = null) {
  if (!branchOption) return true;
  const orderKeys = expandBranchKeys(getOrderBranchCandidates(order));
  const aliases = Array.isArray(branchOption.aliases) ? branchOption.aliases : [];
  return aliases.some((alias) => orderKeys.some((key) => key.toLowerCase() === toText(alias).toLowerCase()));
}

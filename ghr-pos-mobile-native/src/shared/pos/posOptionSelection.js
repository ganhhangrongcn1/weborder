function toPositiveInteger(value = 1) {
  const parsed = Math.floor(Number(value || 1));
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}
export function getPosOptionSelectionMode(group = {}) {
  if (group.selectionMode === "exact") return "exact";
  if (!group.selectionMode && toPositiveInteger(group.maxSelect) === 1) return "exact";
  return "max";
}

export function getPosOptionSelectionLimit(group = {}) {
  const optionCount = Array.isArray(group.options) ? group.options.length : 0;
  return Math.min(optionCount, toPositiveInteger(group.maxSelect));
}

export function buildInitialPosOptionSelections(groups = [], selectedOptions = []) {
  const selectedByGroup = (Array.isArray(selectedOptions) ? selectedOptions : []).reduce((result, option) => {
    if (!option?.groupId || !option?.id) return result;
    const current = result[option.groupId] || [];
    if (!current.includes(option.id)) current.push(option.id);
    return result;
  }, {});

  return (Array.isArray(groups) ? groups : []).reduce((result, group) => {
    const validOptionIds = new Set((group.options || []).map((option) => option.id));
    const existing = (selectedByGroup[group.id] || []).filter((id) => validOptionIds.has(id));
    const limit = getPosOptionSelectionLimit(group);
    const isExactFullGroup = getPosOptionSelectionMode(group) === "exact"
      && limit > 0
      && limit === (group.options || []).length;

    if (existing.length) result[group.id] = existing.slice(0, limit);
    else if (isExactFullGroup) result[group.id] = (group.options || []).map((option) => option.id);
    return result;
  }, {});
}

export function buildSelectedPosOptionList(groups = [], selectedOptions = {}) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => {
    const selectedIds = Array.isArray(selectedOptions[group.id]) ? selectedOptions[group.id] : [];
    return selectedIds.map((optionId) => {
      const option = (group.options || []).find((item) => item.id === optionId);
      return option ? { ...option, groupId: group.id, groupName: group.name } : null;
    }).filter(Boolean);
  });
}

export function isPosOptionGroupComplete(group = {}, selectedOptionIds = []) {
  const selectedCount = Array.isArray(selectedOptionIds) ? selectedOptionIds.length : 0;
  const limit = getPosOptionSelectionLimit(group);
  if (getPosOptionSelectionMode(group) === "exact") return selectedCount === limit;
  return !group.required || selectedCount > 0;
}

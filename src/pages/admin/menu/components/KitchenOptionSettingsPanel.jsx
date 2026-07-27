import { useEffect, useMemo, useState } from "react";
import {
  buildInternalKitchenOptionGroups,
  discoverPartnerOptionGroups,
  loadKitchenOptionGroupSettings,
  saveKitchenOptionGroupSettings,
  shouldAutoEnablePartnerKitchenOption
} from "../../../../services/kitchenOptionGroupSettingsService.js";
import { AdminButton, AdminCard, AdminInput, AdminSelect } from "../../ui/index.js";

const KITCHEN_TYPE_OPTIONS = [
  { value: "main", label: "Món chính" },
  { value: "drink", label: "Nước" },
  { value: "topping", label: "Topping" },
  { value: "addon", label: "Mua kèm" },
  { value: "other", label: "Khác" }
];

const SOURCE_LABELS = {
  website: "Website",
  pos: "POS",
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
  xanhngon: "Xanh Ngon",
  other: "Nguồn khác"
};

const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả nguồn" },
  { value: "website", label: "Website" },
  { value: "pos", label: "POS" },
  { value: "grabfood", label: "GrabFood" },
  { value: "shopeefood", label: "ShopeeFood" },
  { value: "xanhngon", label: "Xanh Ngon" },
  { value: "other", label: "Nguồn khác" }
];

function getIdentity(group = {}) {
  const optionName = String(group.optionName || "").toLowerCase();
  const fallbackName = String(group.groupName || "").toLowerCase();
  if (optionName) {
    const parent = group.groupId ? `id:${group.groupId}` : `name:${fallbackName || "ungrouped"}`;
    return `${group.source || "other"}::${parent}::option:${optionName}`;
  }
  return `${group.source || "other"}::${group.groupId ? `id:${group.groupId}` : `name:${fallbackName}`}`;
}

function getOptionGroupIdentity(group = {}) {
  const source = group.source || "other";
  const groupId = String(group.groupId || "").trim();
  const groupName = String(group.groupName || "").trim().toLowerCase();
  if (!groupId && !groupName) return "";
  return `${source}::${groupId ? `id:${groupId}` : `name:${groupName}`}`;
}

function mergeGroups(savedGroups = [], observedGroups = []) {
  const savedByIdentity = new Map(savedGroups.map((group) => [getIdentity(group), group]));
  const observedIdentities = new Set(observedGroups.map(getIdentity));
  const mergedObserved = observedGroups.map((group, index) => {
    const saved = savedByIdentity.get(getIdentity(group));
    const groupRule = savedGroups.find((candidate) => (
      candidate.groupEnabled &&
      candidate.source === group.source &&
      (
        (candidate.groupId && group.groupId && candidate.groupId === group.groupId) ||
        (
          String(candidate.groupName || "").toLowerCase() &&
          String(candidate.groupName || "").toLowerCase() === String(group.groupName || "").toLowerCase()
        )
      )
    ));
    return {
      ...group,
      ...(saved || {}),
      enabled: saved ? saved.enabled : groupRule ? true : group.enabled,
      groupEnabled: saved ? saved.groupEnabled : Boolean(groupRule),
      kitchenType: saved?.kitchenType || groupRule?.kitchenType || group.kitchenType,
      kitchenLabel: saved?.kitchenLabel || groupRule?.kitchenLabel || group.kitchenLabel,
      sampleOptions: group.sampleOptions?.length
        ? group.sampleOptions
        : saved?.sampleOptions || [],
      sortOrder: saved?.sortOrder ?? groupRule?.sortOrder ?? index,
      groupId: group.groupId || saved?.groupId || groupRule?.groupId || "",
      groupName: group.groupName || saved?.groupName || groupRule?.groupName || "",
      optionName: group.optionName || saved?.optionName || ""
    };
  });
  const savedOnly = savedGroups.filter((group) => !observedIdentities.has(getIdentity(group)));
  return [...mergedObserved, ...savedOnly];
}

export default function KitchenOptionSettingsPanel({ optionGroupPresets = [] }) {
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scanAudit, setScanAudit] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  function formatScanDate(value = "") {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("vi-VN");
  }

  async function loadData({ announce = false } = {}) {
    setLoading(true);
    setMessage("");
    try {
      const [settings, discovery] = await Promise.all([
        loadKitchenOptionGroupSettings(),
        discoverPartnerOptionGroups()
      ]);
      const observedGroups = discovery.groups || [];
      setScanAudit(discovery.audit || null);
      const internalGroups = buildInternalKitchenOptionGroups(optionGroupPresets);
      const mergedGroups = mergeGroups(settings.groups, [...internalGroups, ...observedGroups]);
      const savedIdentities = new Set(settings.groups.map(getIdentity));
      const newPartnerDefaultIdentities = new Set(
        observedGroups
          .filter((group) => (
            shouldAutoEnablePartnerKitchenOption(group) &&
            !savedIdentities.has(getIdentity(group))
          ))
          .map(getIdentity)
      );
      const shouldSavePartnerDefaults = (
        !settings.partnerDefaultsApplied ||
        newPartnerDefaultIdentities.size > 0
      );
      const preparedGroups = mergedGroups.map((group) => (
        (
          shouldAutoEnablePartnerKitchenOption(group) &&
          (
            !settings.partnerDefaultsApplied ||
            newPartnerDefaultIdentities.has(getIdentity(group))
          )
        )
            ? {
                ...group,
                enabled: true,
                groupEnabled: true,
                kitchenType: String(group.groupName || "").toLowerCase().includes("mua kèm")
                  ? "addon"
                  : "topping",
                kitchenLabel: group.groupName
              }
            : group
      ));
      const enabledOptionGroupIdentities = new Set(
        preparedGroups
          .filter((group) => group.enabled)
          .map(getOptionGroupIdentity)
          .filter(Boolean)
      );
      const finalGroups = settings.groupDefaultsApplied
        ? preparedGroups
        : preparedGroups.map((group) => (
          enabledOptionGroupIdentities.has(getOptionGroupIdentity(group))
            ? { ...group, enabled: true, groupEnabled: true }
            : group
        ));
      const shouldSaveDefaults = shouldSavePartnerDefaults || !settings.groupDefaultsApplied;
      setGroups(finalGroups);
      if (shouldSaveDefaults) {
        await saveKitchenOptionGroupSettings({
          version: 3,
          partnerDefaultsApplied: true,
          groupDefaultsApplied: true,
          groups: finalGroups
        });
      }
      if (announce) {
        const dateFrom = formatScanDate(discovery.audit?.dateFrom);
        const dateTo = formatScanDate(discovery.audit?.dateTo);
        const dateLabel = dateFrom && dateTo ? `, từ ${dateFrom} đến ${dateTo}` : "";
        setMessage(
          `Đã quét ${discovery.audit?.orderCount || 0} đơn${dateLabel}; tìm thấy ${observedGroups.length} tùy chọn.`
        );
      }
    } catch (error) {
      console.error("[KitchenOptionSettingsPanel] load failed", error);
      setMessage("Không thể đọc nhóm tùy chọn. Hãy kiểm tra quyền đọc đơn đối tác trên Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [optionGroupPresets]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter((group) => (
      (sourceFilter === "all" || group.source === sourceFilter) &&
      (
        !query ||
        String(group.optionName || "").toLowerCase().includes(query) ||
        String(group.groupName || "").toLowerCase().includes(query) ||
        String(group.groupId || "").toLowerCase().includes(query) ||
        String(group.source || "").toLowerCase().includes(query)
      )
    ));
  }, [groups, search, sourceFilter]);

  const enabledCount = groups.filter((group) => group.enabled).length;
  const groupedFilteredGroups = useMemo(() => {
    const result = new Map();
    filteredGroups.forEach((group) => {
      const groupLabel = group.groupName || "Lựa chọn chưa có nhóm";
      const key = `${group.source || "other"}::${group.groupId || groupLabel.toLowerCase()}`;
      const current = result.get(key) || {
        key,
        label: groupLabel,
        source: group.source,
        options: []
      };
      current.options.push(group);
      result.set(key, current);
    });
    return [...result.values()];
  }, [filteredGroups]);

  function patchGroup(target, patch) {
    const identity = getIdentity(target);
    setGroups((current) => current.map((group) => (
      getIdentity(group) === identity ? { ...group, ...patch } : group
    )));
  }

  function isSameOptionGroup(first = {}, second = {}) {
    if (first.source !== second.source) return false;
    if (first.groupId && second.groupId) return first.groupId === second.groupId;
    return String(first.groupName || "").toLowerCase() === String(second.groupName || "").toLowerCase();
  }

  function toggleOptionGroup(optionGroup, checked) {
    const sample = optionGroup.options[0] || {};
    setGroups((current) => current.map((group) => (
      isSameOptionGroup(group, sample)
        ? { ...group, enabled: checked, groupEnabled: checked }
        : group
    )));
  }

  function toggleSingleOption(target, checked) {
    const identity = getIdentity(target);
    setGroups((current) => current.map((group) => {
      if (!isSameOptionGroup(group, target)) return group;
      if (getIdentity(group) === identity) {
        return { ...group, enabled: checked, groupEnabled: false };
      }
      return group.groupEnabled ? { ...group, groupEnabled: false } : group;
    }));
  }

  function toggleExpandedGroup(key) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveKitchenOptionGroupSettings({
        version: 3,
        partnerDefaultsApplied: true,
        groupDefaultsApplied: true,
        groups
      });
      setGroups((current) => mergeGroups(saved.groups, current));
      setMessage("Đã lưu thiết lập Kitchen lên Supabase.");
    } catch (error) {
      console.error("[KitchenOptionSettingsPanel] save failed", error);
      setMessage("Lưu thất bại. Hãy kiểm tra quyền ghi app_configs của tài khoản Admin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard className="admin-panel admin-menu-section admin-kitchen-settings">
      <div className="admin-panel-head admin-kitchen-settings__head">
        <div>
          <h2>Thiết lập Kitchen</h2>
          <p className="admin-help-text">
            Chọn trực tiếp những tùy chọn cần tạo ô tick riêng tại Kitchen.
            Hệ thống nhận diện theo tên tùy chọn và nguồn bán, không bắt buộc phải có tên nhóm.
          </p>
        </div>
        <div className="admin-kitchen-settings__actions">
          <AdminButton variant="secondary" disabled={loading} onClick={() => loadData({ announce: true })}>
            {loading ? "Đang quét..." : "Quét lại tùy chọn"}
          </AdminButton>
          <AdminButton disabled={loading || saving} onClick={handleSave}>
            {saving ? "Đang lưu..." : "Lưu thiết lập"}
          </AdminButton>
        </div>
      </div>

      <div className="admin-kitchen-settings__summary">
        <strong>{enabledCount} tùy chọn đang tạo ô tick</strong>
        <span>Website/POS lấy từ menu; GrabFood/ShopeeFood lấy từ các đơn đã đồng bộ.</span>
      </div>

      <div className="admin-kitchen-settings__filters">
        <AdminSelect
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          options={SOURCE_FILTER_OPTIONS}
        />
        <AdminInput
          className="admin-input admin-kitchen-settings__search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên tùy chọn, nhóm hoặc nguồn bán"
        />
      </div>

      {message ? <p className="admin-help-text admin-kitchen-settings__message">{message}</p> : null}
      {scanAudit ? (
        <p className="admin-help-text admin-kitchen-settings__audit">
          Phạm vi hiện tại: {scanAudit.orderCount} đơn gần nhất
          {formatScanDate(scanAudit.dateFrom) && formatScanDate(scanAudit.dateTo)
            ? ` (${formatScanDate(scanAudit.dateFrom)} – ${formatScanDate(scanAudit.dateTo)})`
            : ""}
          {" · "}{scanAudit.itemCount} dòng món
          {" · "}{scanAudit.optionsItemCount} dòng có nhóm trong options
          {" · "}{scanAudit.rawDishCount} món có nhóm trong dữ liệu gốc
        </p>
      ) : null}

      {loading ? (
        <div className="admin-kitchen-settings__empty">Đang đọc nhóm tùy chọn từ đơn đối tác...</div>
      ) : groupedFilteredGroups.length ? (
        <div className="admin-kitchen-settings__list">
          {groupedFilteredGroups.map((optionGroup) => (
            <section key={optionGroup.key} className="admin-kitchen-option-group">
              <div className="admin-kitchen-option-group__head">
                <label className="admin-kitchen-option-group__toggle">
                  <input
                    type="checkbox"
                    checked={optionGroup.options.some((option) => option.groupEnabled)}
                    onChange={(event) => toggleOptionGroup(optionGroup, event.target.checked)}
                  />
                  <span>
                    <strong>{optionGroup.label}</strong>
                    <small>
                      {SOURCE_LABELS[optionGroup.source] || optionGroup.source}
                      {" · "}{optionGroup.options.length} tùy chọn
                    </small>
                  </span>
                </label>
                <button
                  type="button"
                  className="admin-kitchen-option-group__expand"
                  aria-expanded={expandedGroups.has(optionGroup.key)}
                  onClick={() => toggleExpandedGroup(optionGroup.key)}
                >
                  {expandedGroups.has(optionGroup.key) ? "Thu gọn ▲" : "Xem món ▼"}
                </button>
              </div>
              {expandedGroups.has(optionGroup.key) ? (
                <div className="admin-kitchen-option-group__options">
                {optionGroup.options.map((group) => (
                  <article key={getIdentity(group)} className={`admin-kitchen-setting-card ${group.enabled ? "is-enabled" : ""}`}>
              <div className="admin-kitchen-setting-card__identity">
                <label className="admin-switch" aria-label={`Tạo ô tick cho ${group.optionName || group.groupName}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(group.enabled)}
                    onChange={(event) => toggleSingleOption(group, event.target.checked)}
                  />
                  <span />
                </label>
                <div>
                  <strong>{group.optionName || group.groupName || "Tùy chọn chưa có tên"}</strong>
                  <small>{SOURCE_LABELS[group.source] || group.source}</small>
                </div>
              </div>

              <div className="admin-kitchen-setting-card__id">
                <span>Nguồn nhận diện</span>
                <code>{SOURCE_LABELS[group.source] || group.source}</code>
              </div>

              <label className="admin-kitchen-setting-card__field">
                <span>Loại công việc</span>
                <AdminSelect
                  value={group.kitchenType || "other"}
                  onChange={(event) => patchGroup(group, { kitchenType: event.target.value })}
                  options={KITCHEN_TYPE_OPTIONS}
                  disabled={!group.enabled}
                />
              </label>

              <label className="admin-kitchen-setting-card__field">
                <span>Tên hiển thị tại Kitchen</span>
                <AdminInput
                  value={group.kitchenLabel || ""}
                  onChange={(event) => patchGroup(group, { kitchenLabel: event.target.value })}
                  placeholder={group.groupName || "Ví dụ: Nước"}
                  disabled={!group.enabled}
                />
              </label>

              <label className="admin-kitchen-setting-card__field admin-kitchen-setting-card__order">
                <span>Thứ tự</span>
                <AdminInput
                  type="number"
                  min="0"
                  value={group.sortOrder ?? 0}
                  onChange={(event) => patchGroup(group, { sortOrder: Number(event.target.value) || 0 })}
                  disabled={!group.enabled}
                />
              </label>

              <div className="admin-kitchen-setting-card__samples">
                <span>Tên dùng để nhận diện</span>
                <div>
                  <em>{group.optionName || group.groupName}</em>
                </div>
              </div>
                  </article>
                ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="admin-kitchen-settings__empty">
          Chưa tìm thấy tùy chọn trong đơn đối tác. Khi có đơn combo, bấm “Quét lại tùy chọn”.
        </div>
      )}
    </AdminCard>
  );
}

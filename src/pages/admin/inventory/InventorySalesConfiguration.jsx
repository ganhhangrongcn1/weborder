import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";
import {
  calculateSalesRecipeComponent,
  getChannelCandidateIdentity,
  isChannelCandidateMapped
} from "../../../services/inventorySalesRecipeCalculations.js";
import InventoryChannelMappingModal from "./InventoryChannelMappingModal.jsx";
import InventorySalesRecipeModal from "./InventorySalesRecipeModal.jsx";
import { getInventoryMenuEntityKindLabel } from "../../../services/inventoryMenuEntityService.js";

const STATUS_META = {
  draft: { label: "Bản nháp", tone: "draft" },
  active: { label: "Đang áp dụng", tone: "active" },
  inactive: { label: "Ngừng áp dụng", tone: "inactive" }
};
const SOURCE_LABELS = { grabfood: "GrabFood", shopeefood: "ShopeeFood", xanhngon: "Xanh Ngon", other: "Kênh khác" };
const SOURCE_ORDER = ["shopeefood", "grabfood", "xanhngon", "other"];
const SHOPEE_SHARED_BRANCH = "shopeefood:shared";

function getBranchUuid(branch = {}) {
  return String(branch.branch_uuid || branch.branchUuid || branch.uuid || "").trim();
}

function getChannelBranch(row = {}, branches = []) {
  if (row.partnerSource === "shopeefood") return { value: SHOPEE_SHARED_BRANCH, label: "Dùng chung ShopeeFood" };
  const branch = resolveBranchFromCandidates([row.branchUuid], branches);
  if (branch) {
    return {
      value: String(branch.id || branch.branchUuid || branch.branch_uuid || row.branchUuid),
      label: branch.name || "Chi nhánh được cấp"
    };
  }
  const rawBranch = String(row.branchUuid || "").trim();
  return { value: rawBranch ? `unmatched:${rawBranch}` : "unmatched", label: "Chi nhánh chưa đối chiếu" };
}

function money(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} đ`;
}

function recipeCost(recipe, averageCosts) {
  const total = recipe.components.reduce((sum, line) => sum + calculateSalesRecipeComponent({
    quantity: line.quantity,
    conversionToBase: line.conversionToBase,
    wastePercent: line.wastePercent,
    averageCost: averageCosts[line.itemId] || 0
  }).estimatedCost, 0);
  return total / Math.max(Number(recipe.yieldQuantity || 1), 1);
}

export default function InventorySalesConfiguration({
  recipes = [],
  mappings = [],
  candidates = [],
  candidateMessage = "",
  menuEntities = [],
  items = [],
  units = [],
  branches = [],
  warehouses = [],
  averageCosts = {},
  canWrite = false,
  canManageWarehouseDefaults = false,
  mutationStatus = "idle",
  mutationMessage = "",
  warehouseMutationStatus = "idle",
  warehouseMutationMessage = "",
  onSaveRecipe,
  onActivateRecipe,
  onDeactivateRecipe,
  onDeleteRecipe,
  onSaveMapping,
  onDeleteMapping,
  onSetDefaultWarehouse
}) {
  const [tab, setTab] = useState("recipes");
  const [search, setSearch] = useState("");
  const [channelSource, setChannelSource] = useState("all");
  const [channelBranch, setChannelBranch] = useState("all");
  const [channelKind, setChannelKind] = useState("item");
  const [recipeModal, setRecipeModal] = useState(null);
  const [mappingModal, setMappingModal] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [defaultWarehouseSelections, setDefaultWarehouseSelections] = useState({});
  const query = search.trim().toLocaleLowerCase("vi");
  const unmappedCandidates = useMemo(
    () => candidates.filter((row) => !isChannelCandidateMapped(row, mappings)),
    [candidates, mappings]
  );
  const filteredRecipes = recipes.filter((recipe) => !query || [recipe.code, recipe.menuEntityName, ...recipe.components.map((line) => line.item?.name)].some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
  const allChannelRows = [
    ...unmappedCandidates.map((candidate) => ({ ...candidate, rowType: "candidate" })),
    ...mappings.map((mapping) => ({ ...mapping, rowType: "mapping" }))
  ].map((row) => ({ ...row, channelBranch: getChannelBranch(row, branches) }));
  const channelKindCounts = allChannelRows.reduce((counts, row) => {
    const kind = (row.mappingKind || row.candidateKind) === "option" ? "option" : "item";
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, { item: 0, option: 0 });
  const channelKindRows = allChannelRows.filter((row) => (
    ((row.mappingKind || row.candidateKind) === "option" ? "option" : "item") === channelKind
  ));
  const channelSourceCounts = channelKindRows.reduce((counts, row) => {
    const source = row.partnerSource || "other";
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const availableChannelSources = SOURCE_ORDER.filter((source) => channelSourceCounts[source]);
  const sourceFilteredChannelRows = channelKindRows.filter((row) => channelSource === "all" || (row.partnerSource || "other") === channelSource);
  const channelBranchOptions = Array.from(sourceFilteredChannelRows.reduce((options, row) => {
    const current = options.get(row.channelBranch.value) || { ...row.channelBranch, count: 0 };
    current.count += 1;
    options.set(row.channelBranch.value, current);
    return options;
  }, new Map()).values());
  const channelRows = sourceFilteredChannelRows.filter((row) => {
    if (channelBranch !== "all" && row.channelBranch.value !== channelBranch) return false;
    return !query || [row.externalItemName, row.externalOptionGroup, row.externalOptionName, SOURCE_LABELS[row.partnerSource], ...((row.targets || []).map((target) => target.menuEntityName))].some((value) => String(value || "").toLocaleLowerCase("vi").includes(query));
  });
  const warehouseRows = useMemo(() => branches.map((branch) => {
    const branchUuid = getBranchUuid(branch);
    const options = warehouses.filter((warehouse) => warehouse.isActive !== false
      && warehouse.warehouseType === "branch"
      && resolveBranchFromCandidates([warehouse.branchUuid], [branch]));
    const current = options.find((warehouse) => warehouse.isDefaultForBranch) || null;
    return { branch, branchUuid, options, current };
  }).filter((row) => row.branchUuid), [branches, warehouses]);

  useEffect(() => {
    setDefaultWarehouseSelections(Object.fromEntries(warehouseRows.map((row) => [row.branchUuid, row.current?.id || ""])));
  }, [warehouseRows]);

  const saveDefaultWarehouse = async (row) => {
    const warehouseId = defaultWarehouseSelections[row.branchUuid] || "";
    if (!warehouseId || warehouseId === row.current?.id || !onSetDefaultWarehouse) return;
    try {
      await onSetDefaultWarehouse({ branchUuid: row.branchUuid, warehouseId });
    } catch {
      // Lỗi được hiển thị từ hook Kho ngay trong thẻ thiết lập.
    }
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    try {
      if (confirmation.type === "activate") await onActivateRecipe(confirmation.id);
      if (confirmation.type === "deactivate") await onDeactivateRecipe(confirmation.id);
      if (confirmation.type === "delete-recipe") await onDeleteRecipe(confirmation.id);
      if (confirmation.type === "delete-mapping") await onDeleteMapping(confirmation.id);
      setConfirmation(null);
    } catch {
      // Lỗi được hiển thị tại thông báo chung của màn hình.
    }
  };

  return (
    <section className="inventory-list-card inventory-sales-manager">
      <div className="inventory-sales-manager__head">
        <div><span><Icon name="tag" size={20} /></span><div><strong>Định lượng và kênh bán</strong><small>Ghép món Menu với nguyên liệu trực tiếp và đồng nhất tên món từ các app.</small></div></div>
        {tab === "recipes" ? <button type="button" disabled={!canWrite || !menuEntities.length} onClick={() => setRecipeModal({ mode: "edit", recipe: {} })}><Icon name="plus" size={16} /> Tạo định lượng</button> : null}
      </div>

      <div className="inventory-sales-tabs" role="tablist">
        <button type="button" className={tab === "recipes" ? "is-active" : ""} onClick={() => { setTab("recipes"); setSearch(""); }}><Icon name="menu" size={16} /> Định lượng món bán <span>{recipes.length}</span></button>
        <button type="button" className={tab === "channels" ? "is-active" : ""} onClick={() => { setTab("channels"); setSearch(""); setChannelKind("item"); setChannelSource("all"); setChannelBranch("all"); }}><Icon name="share" size={16} /> Ánh xạ kênh bán {unmappedCandidates.length ? <span className="is-alert">{unmappedCandidates.length}</span> : <span>{mappings.length}</span>}</button>
        <button type="button" className={tab === "warehouses" ? "is-active" : ""} onClick={() => { setTab("warehouses"); setSearch(""); }}><Icon name="store" size={16} /> Kho trừ mặc định <span>{warehouseRows.filter((row) => row.current).length}/{warehouseRows.length}</span></button>
      </div>

      <div className="inventory-sales-safe-note"><Icon name="check" size={16} /> {tab === "warehouses" ? "Thiết lập một lần cho mỗi chi nhánh. Thao tác này không làm thay đổi số tồn hiện tại." : "Hoàn tất định lượng và ánh xạ trước khi đơn bán được ghi giảm tồn."}</div>
      {tab === "channels" ? <div className="inventory-channel-kind-cards" role="tablist" aria-label="Loại ánh xạ kênh bán">
        <button type="button" role="tab" aria-selected={channelKind === "item"} className={channelKind === "item" ? "is-active" : ""} onClick={() => { setChannelKind("item"); setSearch(""); setChannelSource("all"); setChannelBranch("all"); }}><span><Icon name="bag" size={19} /></span><div><strong>Gán món chính</strong><small>Món lẻ hoặc combo bên ngoài đơn hàng</small></div><b>{channelKindCounts.item}</b></button>
        <button type="button" role="tab" aria-selected={channelKind === "option"} className={channelKind === "option" ? "is-active" : ""} onClick={() => { setChannelKind("option"); setSearch(""); setChannelSource("all"); setChannelBranch("all"); }}><span><Icon name="tag" size={19} /></span><div><strong>Gán lựa chọn / topping</strong><small>Sốt, topping và món tự chọn trong combo</small></div><b>{channelKindCounts.option}</b></button>
      </div> : null}
      {tab === "channels" && candidateMessage ? <div className="inventory-count-notice is-error"><Icon name="warning" size={16} />{candidateMessage}</div> : null}
      {tab === "channels" && !candidateMessage ? <div className="inventory-channel-filter-note"><Icon name="eyeOff" size={16} />Đã tự ẩn cách chế biến và mức cay vì không làm thay đổi tồn kho. Lựa chọn dùng chung chỉ cần gán một lần.</div> : null}
      {tab !== "warehouses" && mutationMessage ? <div className={`inventory-count-notice${mutationStatus === "error" ? " is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={16} />{mutationMessage}</div> : null}
      {tab === "warehouses" && warehouseMutationMessage ? <div className={`inventory-count-notice${warehouseMutationStatus === "error" ? " is-error" : ""}`}><Icon name={warehouseMutationStatus === "error" ? "warning" : "check"} size={16} />{warehouseMutationMessage}</div> : null}
      {tab !== "warehouses" ? <div className="inventory-list-toolbar inventory-bom-toolbar">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "recipes" ? "Tìm món hoặc nguyên liệu..." : "Tìm tên món trên app hoặc món Menu..."} /></label>
        {tab === "channels" ? (
          <InventorySearchableSelect value={channelSource} onChange={(event) => { setChannelSource(event.target.value); setChannelBranch("all"); }} aria-label="Lọc theo kênh bán">
            <option value="all">Tất cả kênh ({channelKindRows.length})</option>
            {availableChannelSources.map((source) => <option key={source} value={source}>{SOURCE_LABELS[source]} ({channelSourceCounts[source]})</option>)}
          </InventorySearchableSelect>
        ) : null}
        {tab === "channels" ? (
          <InventorySearchableSelect value={channelBranch} onChange={(event) => setChannelBranch(event.target.value)} aria-label="Lọc theo chi nhánh">
            <option value="all">Tất cả chi nhánh ({sourceFilteredChannelRows.length})</option>
            {channelBranchOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
          </InventorySearchableSelect>
        ) : null}
      </div> : null}

      {tab === "recipes" ? (
        <div className="inventory-table-scroll">
          <table className="inventory-data-table inventory-sales-table">
            <thead><tr><th>Món / topping</th><th>Phạm vi</th><th>Thành phần trực tiếp</th><th>Cost ước tính</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{filteredRecipes.map((recipe) => {
              const status = STATUS_META[recipe.status] || STATUS_META.draft;
              const entity = menuEntities.find((row) => row.id === recipe.menuEntityId && row.type === recipe.menuEntityType);
              const cost = recipeCost(recipe, averageCosts);
              const costRate = Number(entity?.price || 0) > 0 ? cost / Number(entity.price) * 100 : 0;
              return <tr key={recipe.id}>
                <td><strong>{recipe.menuEntityName}</strong><small>{recipe.code} · {getInventoryMenuEntityKindLabel(entity || { type: recipe.menuEntityType })}</small></td>
                <td><span className="inventory-bom-scope">{branches.find((branch) => branch.id === recipe.branchUuid)?.name || "Tất cả chi nhánh"}</span><small>{recipe.yieldQuantity} phần chuẩn</small></td>
                <td><strong>{recipe.components.length} thành phần</strong><small>{recipe.components.slice(0, 3).map((line) => line.item?.name).filter(Boolean).join(", ")}</small></td>
                <td><strong>{money(cost)} / phần</strong><small>{costRate ? `${costRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% giá bán` : "Chưa có giá bán"}</small></td>
                <td><span className={`inventory-bom-status is-${status.tone}`}>{status.label}</span></td>
                <td><div className="inventory-row-actions inventory-sales-actions"><button type="button" onClick={() => setRecipeModal({ mode: "view", recipe })}><Icon name="eye" size={14} /> Xem</button>{canWrite && recipe.status === "draft" ? <button type="button" onClick={() => setRecipeModal({ mode: "edit", recipe })}><Icon name="edit" size={14} /> Sửa</button> : null}{canWrite && recipe.status === "active" ? <button type="button" onClick={() => setRecipeModal({ mode: "edit", recipe: { ...recipe, id: "", code: "", status: "draft", effectiveFrom: new Date().toISOString().slice(0, 10) } })}><Icon name="edit" size={14} /> Tạo bản mới</button> : null}{canWrite && recipe.status === "draft" ? <button type="button" className="is-primary" onClick={() => setConfirmation({ type: "activate", id: recipe.id, label: recipe.menuEntityName })}><Icon name="check" size={14} /> Áp dụng</button> : null}{canWrite && recipe.status === "active" ? <button type="button" className="is-danger" onClick={() => setConfirmation({ type: "deactivate", id: recipe.id, label: recipe.menuEntityName })}><Icon name="close" size={14} /> Ngừng</button> : null}{canWrite && recipe.status === "draft" ? <button type="button" className="is-danger" onClick={() => setConfirmation({ type: "delete-recipe", id: recipe.id, label: recipe.menuEntityName })}><Icon name="trash" size={14} /> Xóa</button> : null}</div></td>
              </tr>;
            })}</tbody>
          </table>
          {!filteredRecipes.length ? <div className="inventory-list-empty"><span><Icon name="menu" size={24} /></span><strong>Chưa có định lượng món bán</strong><span>Chọn món trong Menu rồi thêm phần nguyên liệu hoặc bán thành phẩm dùng trực tiếp.</span></div> : null}
        </div>
      ) : tab === "channels" ? (
        <div className="inventory-table-scroll">
          <table className="inventory-data-table inventory-channel-table">
            <thead><tr><th>Kênh</th><th>Món / lựa chọn trên app</th><th>Chi nhánh</th><th>Gán vào Menu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{channelRows.map((row) => {
              const title = (row.mappingKind || row.candidateKind) === "option" ? row.externalOptionName : row.externalItemName;
              const itemScope = row.externalItemName === "*" ? "Áp dụng cho mọi món" : row.externalItemName;
              return <tr key={`${row.rowType}:${row.id || getChannelCandidateIdentity(row)}`}>
                <td><span className={`inventory-channel-badge is-${row.partnerSource}`}>{SOURCE_LABELS[row.partnerSource] || row.partnerSource}</span></td>
                <td><strong>{title}</strong><small>{(row.mappingKind || row.candidateKind) === "option" ? `${itemScope} · ${row.externalOptionGroup === "*" ? "Dùng chung mọi nhóm lựa chọn" : row.externalOptionGroup}` : row.externalItemId || `${row.occurrences || 0} lần xuất hiện`}</small></td>
                <td><strong>{row.channelBranch.label}</strong></td>
                <td>{row.rowType === "candidate" ? <span>—</span> : row.ignoreInventory ? <span className="inventory-channel-ignore-badge">Không trừ kho</span> : <><strong>{row.targets.map((target) => `${target.menuEntityName} × ${target.quantity}`).join(" + ")}</strong><small>{row.targets.length > 1 ? "Cộng định lượng theo từng phần" : (row.mappingKind === "option" ? "Định lượng lựa chọn riêng" : "Gán trực tiếp")}</small></>}</td>
                <td>{row.rowType === "candidate" ? <span className="inventory-bom-status is-draft">Chưa ánh xạ</span> : <span className="inventory-bom-status is-active">Đã gán</span>}</td>
                <td><div className="inventory-row-actions inventory-sales-actions">{row.rowType === "candidate" ? <button type="button" className="is-primary" disabled={!canWrite} onClick={() => setMappingModal(row)}><Icon name="plus" size={14} />{channelKind === "option" ? "Gán lựa chọn" : "Gán món"}</button> : <><button type="button" disabled={!canWrite} onClick={() => setMappingModal(row)}><Icon name="edit" size={14} /> Sửa</button><button type="button" className="is-danger" disabled={!canWrite} onClick={() => setConfirmation({ type: "delete-mapping", id: row.id, label: title })}><Icon name="trash" size={14} /> Xóa</button></>}</div></td>
              </tr>;
            })}</tbody>
          </table>
          {!channelRows.length ? <div className="inventory-list-empty"><span><Icon name={channelKind === "option" ? "tag" : "share"} size={24} /></span><strong>{channelSource !== "all" || channelBranch !== "all" || query ? "Không có dữ liệu phù hợp bộ lọc" : channelKind === "option" ? "Chưa có lựa chọn hoặc topping cần gán" : "Chưa có món app cần ánh xạ"}</strong><span>{channelSource !== "all" || channelBranch !== "all" || query ? "Đổi kênh bán, chi nhánh hoặc từ khóa để xem lại." : "Dữ liệu sẽ xuất hiện khi Supabase nhận đơn từ GrabFood, ShopeeFood hoặc kênh đối tác."}</span></div> : null}
        </div>
      ) : tab === "warehouses" ? (
        <div className="inventory-default-warehouse-panel">
          <div className="inventory-default-warehouse-panel__intro">
            <span><Icon name="store" size={19} /></span>
            <div><strong>Kho trừ khi đơn bán hoàn thành</strong><small>Website, POS và các app dùng chung kho đã chọn của từng chi nhánh.</small></div>
          </div>
          <div className="inventory-table-scroll">
            <table className="inventory-data-table inventory-default-warehouse-table">
              <thead><tr><th>Chi nhánh</th><th>Kho trừ mặc định</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>{warehouseRows.map((row) => {
                const selectedId = defaultWarehouseSelections[row.branchUuid] || "";
                const changed = Boolean(selectedId && selectedId !== row.current?.id);
                return <tr key={row.branchUuid}>
                  <td><strong>{row.branch.name || "Chi nhánh chưa đặt tên"}</strong><small>Áp dụng cho mọi kênh bán của chi nhánh</small></td>
                  <td><InventorySearchableSelect value={selectedId} disabled={!canManageWarehouseDefaults || !row.options.length || warehouseMutationStatus === "saving"} onChange={(event) => setDefaultWarehouseSelections((current) => ({ ...current, [row.branchUuid]: event.target.value }))}><option value="">Chọn kho chi nhánh</option>{row.options.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</InventorySearchableSelect></td>
                  <td>{row.current ? <span className="inventory-bom-status is-active">Đã thiết lập</span> : <span className="inventory-bom-status is-draft">Chưa thiết lập</span>}</td>
                  <td><button type="button" className="inventory-default-warehouse-save" disabled={!canManageWarehouseDefaults || !changed || warehouseMutationStatus === "saving"} onClick={() => saveDefaultWarehouse(row)}><Icon name="check" size={14} />{warehouseMutationStatus === "saving" && changed ? "Đang lưu..." : "Lưu"}</button></td>
                </tr>;
              })}</tbody>
            </table>
            {!warehouseRows.length ? <div className="inventory-list-empty"><span><Icon name="store" size={24} /></span><strong>Chưa có chi nhánh để thiết lập</strong><span>Hãy tạo kho chi nhánh trước, sau đó quay lại chọn kho trừ mặc định.</span></div> : null}
          </div>
          {!canManageWarehouseDefaults && warehouseRows.length ? <div className="inventory-default-warehouse-panel__readonly"><Icon name="eye" size={15} />Tài khoản hiện tại chỉ được xem thiết lập. Admin toàn hệ thống mới có quyền thay đổi.</div> : null}
        </div>
      ) : null}

      {recipeModal ? <InventorySalesRecipeModal recipe={recipeModal.recipe} menuEntities={menuEntities} items={items} units={units} branches={branches} averageCosts={averageCosts} readOnly={recipeModal.mode === "view"} isSaving={mutationStatus === "saving"} onClose={() => setRecipeModal(null)} onSave={onSaveRecipe} /> : null}
      {mappingModal ? <InventoryChannelMappingModal source={mappingModal} menuEntities={menuEntities} branches={branches} isSaving={mutationStatus === "saving"} onClose={() => setMappingModal(null)} onSave={onSaveMapping} /> : null}
      {confirmation ? <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmation(null)}><section className="inventory-warehouse-modal inventory-bom-confirm-modal" role="alertdialog" aria-modal="true"><header><div className="inventory-modal-heading"><span><Icon name={confirmation.type === "activate" ? "check" : confirmation.type === "deactivate" ? "close" : "trash"} size={20} /></span><div><h2>{confirmation.type === "activate" ? "Áp dụng định lượng?" : confirmation.type === "deactivate" ? "Ngừng áp dụng định lượng?" : "Xóa cấu hình?"}</h2><p>{confirmation.label}</p></div></div><button type="button" onClick={() => setConfirmation(null)} aria-label="Đóng"><Icon name="close" size={18} /></button></header><div className="inventory-bom-confirm-modal__body"><div className={`inventory-bom-confirm-modal__notice ${confirmation.type === "activate" ? "is-success" : "is-warning"}`}><Icon name={confirmation.type === "activate" ? "check" : "warning"} size={18} /><div><strong>{confirmation.type === "activate" ? "Mở định lượng cho đơn bán mới" : confirmation.type === "deactivate" ? "Đơn mới sẽ không dùng định lượng này" : "Chỉ xóa bản nháp"}</strong><span>Lịch sử đơn và chứng từ kho trước đây vẫn được giữ nguyên.</span></div></div></div><footer className="inventory-bom-confirm-modal__footer"><button type="button" onClick={() => setConfirmation(null)}>Đóng</button><button type="button" className={confirmation.type === "activate" ? "is-primary" : "is-danger"} disabled={mutationStatus === "saving"} onClick={confirmAction}>Xác nhận</button></footer></section></div> : null}
    </section>
  );
}

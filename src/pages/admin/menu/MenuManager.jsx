import { useMemo, useState } from "react";
import MenuGroupEditorModal from "./MenuGroupEditorModal.jsx";
import MenuCategoryEditorModal from "./MenuCategoryEditorModal.jsx";
import MenuOverviewPanel from "./components/MenuOverviewPanel.jsx";
import MenuGroupsPanel from "./components/MenuGroupsPanel.jsx";
import useMenuManagerState from "./hooks/useMenuManagerState.js";
import useMenuManagerActions from "./hooks/useMenuManagerActions.js";
import { syncMenuCatalogToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { AdminButton, AdminCard, AdminInput, AdminTabs } from "../ui/index.js";

export default function MenuManager({
  products,
  setProducts,
  setToppings,
  toppings,
  adminCategories,
  setAdminCategories,
  optionGroupPresets,
  setOptionGroupPresets,
  onEditProduct
}) {
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const canSyncMenu = useMemo(() => Array.isArray(products) && products.length > 0, [products]);

  const state = useMenuManagerState({
    products,
    adminCategories,
    optionGroupPresets
  });

  const actions = useMenuManagerActions({
    products,
    setProducts,
    toppings,
    setToppings,
    adminCategories,
    setAdminCategories,
    optionGroupPresets,
    setOptionGroupPresets,
    onEditProduct,
    selectedPresetId: state.selectedPresetId,
    setSelectedPresetId: state.setSelectedPresetId,
    setEditingPresetId: state.setEditingPresetId,
    setEditingPresetDraft: state.setEditingPresetDraft,
    setGroupEditorOpen: state.setGroupEditorOpen,
    editingPresetDraft: state.editingPresetDraft,
    editingCategoryName: state.editingCategoryName,
    editingCategoryDraft: state.editingCategoryDraft,
    setCategoryEditorOpen: state.setCategoryEditorOpen,
    setSelectedAdminCategory: state.setSelectedAdminCategory
  });

  const sanitizeStandaloneToppings = (list = []) =>
    (Array.isArray(list) ? list : []).filter((item) => String(item?.name || "").trim() !== "");

  const sanitizeOptionGroupPresets = (presets = []) =>
    (Array.isArray(presets) ? presets : [])
      .map((group) => ({
        ...group,
        options: (Array.isArray(group?.options) ? group.options : [])
          .filter((option) => String(option?.name || "").trim() !== "")
      }))
      .filter((group) => (group.options || []).length > 0);

  const handleSyncMenuToSupabase = async () => {
    if (!canSyncMenu || syncingMenu) return;
    setSyncingMenu(true);
    setSyncStatus("");
    try {
      const nextToppings = sanitizeStandaloneToppings(toppings);
      const nextOptionGroupPresets = sanitizeOptionGroupPresets(optionGroupPresets);
      if (JSON.stringify(nextToppings) !== JSON.stringify(toppings)) {
        setToppings(nextToppings);
      }
      if (JSON.stringify(nextOptionGroupPresets) !== JSON.stringify(optionGroupPresets)) {
        setOptionGroupPresets(nextOptionGroupPresets);
      }

      const result = await syncMenuCatalogToSupabase({
        products,
        categories: adminCategories,
        toppings: nextToppings,
        optionGroupPresets: nextOptionGroupPresets
      });
      if (result?.ok) {
        setSyncStatus("Đã lưu menu lên Supabase.");
      } else {
        setSyncStatus("Chưa thể lưu menu lên Supabase ở mode hiện tại.");
      }
    } catch (_error) {
      setSyncStatus("Lưu menu lên Supabase thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setSyncingMenu(false);
    }
  };

  return (
    <div className="admin-menu-dashboard admin-menu-page">
      <div className="flex items-center justify-between gap-3">
        <h2 className="admin-menu-title">Bánh Tráng Trộn - Gánh Hàng Rong</h2>
        <AdminButton
          variant={canSyncMenu ? "primary" : "secondary"}
          className={!canSyncMenu ? "opacity-70 cursor-not-allowed" : ""}
          disabled={!canSyncMenu || syncingMenu}
          onClick={handleSyncMenuToSupabase}
        >
          {syncingMenu ? "Đang lưu..." : "Lưu menu lên Supabase"}
        </AdminButton>
      </div>
      {syncStatus ? <p className="admin-help-text">{syncStatus}</p> : null}

      <AdminTabs
        className="admin-menu-main-tabs"
        value={state.menuTab}
        onChange={state.setMenuTab}
        tabs={[
          { value: "overview", label: "Tổng quan menu" },
          { value: "groups", label: "Tùy chọn nhóm" },
          { value: "bulk", label: "Thêm Cho Đủ Vị (Topping rời)" }
        ]}
      />

      {state.menuTab === "overview" && (
        <MenuOverviewPanel
          createMenuOpen={state.createMenuOpen}
          setCreateMenuOpen={state.setCreateMenuOpen}
          addProduct={actions.addProduct}
          addCategory={actions.addCategory}
          viewFilter={state.viewFilter}
          setViewFilter={state.setViewFilter}
          selectedAdminCategory={state.selectedAdminCategory}
          setSelectedAdminCategory={state.setSelectedAdminCategory}
          adminCategories={adminCategories}
          productSearch={state.productSearch}
          setProductSearch={state.setProductSearch}
          products={products}
          categoryStats={state.categoryStats}
          setCategoryVisibility={actions.setCategoryVisibility}
          openCategoryEditor={(categoryName) =>
            actions.openCategoryEditor(categoryName, state.setEditingCategoryName, state.setEditingCategoryDraft)
          }
          filteredAdminProducts={state.filteredAdminProducts}
          setProductVisibility={actions.setProductVisibility}
          onEditProduct={onEditProduct}
        />
      )}

      {state.menuTab === "groups" && (
        <MenuGroupsPanel
          createPreset={actions.createPreset}
          groupSearch={state.groupSearch}
          setGroupSearch={state.setGroupSearch}
          filteredPresets={state.filteredPresets}
          selectedPreset={state.selectedPreset}
          setSelectedPresetId={state.setSelectedPresetId}
          openPresetEditor={actions.openPresetEditor}
          updatePresetOption={actions.updatePresetOption}
          removePresetOption={actions.removePresetOption}
          addPresetOption={actions.addPresetOption}
        />
      )}

      {state.menuTab === "bulk" && (
        <AdminCard className="admin-panel admin-menu-section admin-menu-bulk-section">
          <div className="admin-panel-head">
            <h2>Thêm Cho Đủ Vị (Topping rời)</h2>
            <AdminButton onClick={actions.addTopping}>Thêm topping</AdminButton>
          </div>
          <p className="admin-help-text">Quản lý danh sách topping rời dùng chung cho cửa hàng. Có thể thêm, đổi tên, đổi giá hoặc xóa nhanh.</p>
          <div className="admin-mini-grid">
            {toppings.map((topping) => (
              <div key={topping.id} className="admin-mini-card">
                <AdminInput className="admin-input" value={topping.name} onChange={(event) => actions.updateTopping(topping.id, { name: event.target.value })} />
                <AdminInput className="admin-input" type="number" value={topping.price} onChange={(event) => actions.updateTopping(topping.id, { price: Number(event.target.value) })} />
                <AdminButton variant="danger" className="admin-danger" onClick={() => setToppings(toppings.filter((item) => item.id !== topping.id))}>Xóa</AdminButton>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      <MenuGroupEditorModal
        open={state.groupEditorOpen}
        onClose={() => state.setGroupEditorOpen(false)}
        editingPresetDraft={state.editingPresetDraft}
        editingPresetId={state.editingPresetId}
        optionGroupPresets={optionGroupPresets}
        draggingEditingOptionId={state.draggingEditingOptionId}
        setDraggingEditingOptionId={state.setDraggingEditingOptionId}
        reorderEditingOptions={actions.reorderEditingOptions}
        patchEditingPreset={actions.patchEditingPreset}
        patchEditingOption={actions.patchEditingOption}
        removeEditingOption={actions.removeEditingOption}
        addEditingOption={actions.addEditingOption}
        savePresetFromEditor={actions.savePresetFromEditor}
        deletePresetFromEditor={actions.deletePresetFromEditor}
      />

      <MenuCategoryEditorModal
        open={state.categoryEditorOpen}
        onClose={() => state.setCategoryEditorOpen(false)}
        editingCategoryDraft={state.editingCategoryDraft}
        setEditingCategoryDraft={state.setEditingCategoryDraft}
        deleteCategoryFromEditor={actions.deleteCategoryFromEditor}
        saveCategoryEditor={actions.saveCategoryEditor}
      />
    </div>
  );
}

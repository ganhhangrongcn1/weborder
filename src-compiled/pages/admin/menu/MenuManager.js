import { useMemo, useState } from "react";
import MenuGroupEditorModal from "./MenuGroupEditorModal.js";
import MenuCategoryEditorModal from "./MenuCategoryEditorModal.js";
import MenuOverviewPanel from "./components/MenuOverviewPanel.js";
import MenuGroupsPanel from "./components/MenuGroupsPanel.js";
import useMenuManagerState from "./hooks/useMenuManagerState.js";
import useMenuManagerActions from "./hooks/useMenuManagerActions.js";
import { syncMenuCatalogToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { AdminButton, AdminCard, AdminInput, AdminTabs } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
  const sanitizeStandaloneToppings = (list = []) => (Array.isArray(list) ? list : []).filter(item => String(item?.name || "").trim() !== "");
  const sanitizeOptionGroupPresets = (presets = []) => (Array.isArray(presets) ? presets : []).map(group => ({
    ...group,
    options: (Array.isArray(group?.options) ? group.options : []).filter(option => String(option?.name || "").trim() !== "")
  })).filter(group => (group.options || []).length > 0);
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
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-menu-dashboard admin-menu-page",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "flex items-center justify-between gap-3",
      children: [/*#__PURE__*/_jsx("h2", {
        className: "admin-menu-title",
        children: "B\xE1nh Tr\xE1ng Tr\u1ED9n - G\xE1nh H\xE0ng Rong"
      }), /*#__PURE__*/_jsx(AdminButton, {
        variant: canSyncMenu ? "primary" : "secondary",
        className: !canSyncMenu ? "opacity-70 cursor-not-allowed" : "",
        disabled: !canSyncMenu || syncingMenu,
        onClick: handleSyncMenuToSupabase,
        children: syncingMenu ? "Đang lưu..." : "Lưu menu lên Supabase"
      })]
    }), syncStatus ? /*#__PURE__*/_jsx("p", {
      className: "admin-help-text",
      children: syncStatus
    }) : null, /*#__PURE__*/_jsx(AdminTabs, {
      className: "admin-menu-main-tabs",
      value: state.menuTab,
      onChange: state.setMenuTab,
      tabs: [{
        value: "overview",
        label: "Tổng quan menu"
      }, {
        value: "groups",
        label: "Tùy chọn nhóm"
      }, {
        value: "bulk",
        label: "Thêm Cho Đủ Vị (Topping rời)"
      }]
    }), state.menuTab === "overview" && /*#__PURE__*/_jsx(MenuOverviewPanel, {
      createMenuOpen: state.createMenuOpen,
      setCreateMenuOpen: state.setCreateMenuOpen,
      addProduct: actions.addProduct,
      addCategory: actions.addCategory,
      viewFilter: state.viewFilter,
      setViewFilter: state.setViewFilter,
      selectedAdminCategory: state.selectedAdminCategory,
      setSelectedAdminCategory: state.setSelectedAdminCategory,
      adminCategories: adminCategories,
      productSearch: state.productSearch,
      setProductSearch: state.setProductSearch,
      products: products,
      categoryStats: state.categoryStats,
      setCategoryVisibility: actions.setCategoryVisibility,
      openCategoryEditor: categoryName => actions.openCategoryEditor(categoryName, state.setEditingCategoryName, state.setEditingCategoryDraft),
      reorderAdminCategory: actions.reorderAdminCategory,
      filteredAdminProducts: state.filteredAdminProducts,
      setProductVisibility: actions.setProductVisibility,
      onEditProduct: onEditProduct
    }), state.menuTab === "groups" && /*#__PURE__*/_jsx(MenuGroupsPanel, {
      createPreset: actions.createPreset,
      groupSearch: state.groupSearch,
      setGroupSearch: state.setGroupSearch,
      filteredPresets: state.filteredPresets,
      selectedPreset: state.selectedPreset,
      setSelectedPresetId: state.setSelectedPresetId,
      openPresetEditor: actions.openPresetEditor,
      updatePresetOption: actions.updatePresetOption,
      removePresetOption: actions.removePresetOption,
      addPresetOption: actions.addPresetOption
    }), state.menuTab === "bulk" && /*#__PURE__*/_jsxs(AdminCard, {
      className: "admin-panel admin-menu-section admin-menu-bulk-section",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-panel-head",
        children: [/*#__PURE__*/_jsx("h2", {
          children: "Th\xEAm Cho \u0110\u1EE7 V\u1ECB (Topping r\u1EDDi)"
        }), /*#__PURE__*/_jsx(AdminButton, {
          onClick: actions.addTopping,
          children: "Th\xEAm topping"
        })]
      }), /*#__PURE__*/_jsx("p", {
        className: "admin-help-text",
        children: "Qu\u1EA3n l\xFD danh s\xE1ch topping r\u1EDDi d\xF9ng chung cho c\u1EEDa h\xE0ng. C\xF3 th\u1EC3 th\xEAm, \u0111\u1ED5i t\xEAn, \u0111\u1ED5i gi\xE1 ho\u1EB7c x\xF3a nhanh."
      }), /*#__PURE__*/_jsx("div", {
        className: "admin-mini-grid",
        children: toppings.map(topping => /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx(AdminInput, {
            className: "admin-input",
            value: topping.name,
            onChange: event => actions.updateTopping(topping.id, {
              name: event.target.value
            })
          }), /*#__PURE__*/_jsx(AdminInput, {
            className: "admin-input",
            type: "number",
            value: topping.price,
            onChange: event => actions.updateTopping(topping.id, {
              price: Number(event.target.value)
            })
          }), /*#__PURE__*/_jsx(AdminButton, {
            variant: "danger",
            className: "admin-danger",
            onClick: () => setToppings(toppings.filter(item => item.id !== topping.id)),
            children: "X\xF3a"
          })]
        }, topping.id))
      })]
    }), /*#__PURE__*/_jsx(MenuGroupEditorModal, {
      open: state.groupEditorOpen,
      onClose: () => state.setGroupEditorOpen(false),
      editingPresetDraft: state.editingPresetDraft,
      editingPresetId: state.editingPresetId,
      optionGroupPresets: optionGroupPresets,
      draggingEditingOptionId: state.draggingEditingOptionId,
      setDraggingEditingOptionId: state.setDraggingEditingOptionId,
      reorderEditingOptions: actions.reorderEditingOptions,
      patchEditingPreset: actions.patchEditingPreset,
      patchEditingOption: actions.patchEditingOption,
      removeEditingOption: actions.removeEditingOption,
      addEditingOption: actions.addEditingOption,
      savePresetFromEditor: actions.savePresetFromEditor,
      deletePresetFromEditor: actions.deletePresetFromEditor
    }), /*#__PURE__*/_jsx(MenuCategoryEditorModal, {
      open: state.categoryEditorOpen,
      onClose: () => state.setCategoryEditorOpen(false),
      isCreating: !state.editingCategoryName,
      editingCategoryDraft: state.editingCategoryDraft,
      setEditingCategoryDraft: state.setEditingCategoryDraft,
      deleteCategoryFromEditor: actions.deleteCategoryFromEditor,
      saveCategoryEditor: actions.saveCategoryEditor
    })]
  });
}
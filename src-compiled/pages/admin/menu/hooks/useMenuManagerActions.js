import { products as productSeed } from "../../../../data/products.js";
import { normalizePresetDraft } from "../menuManager.utils.js";

export default function useMenuManagerActions({
  products,
  setProducts,
  toppings,
  setToppings,
  adminCategories,
  setAdminCategories,
  optionGroupPresets,
  setOptionGroupPresets,
  onEditProduct,
  selectedPresetId,
  setSelectedPresetId,
  setEditingPresetId,
  setEditingPresetDraft,
  setGroupEditorOpen,
  editingPresetDraft,
  editingCategoryName,
  editingCategoryDraft,
  setCategoryEditorOpen,
  setSelectedAdminCategory
}) {
  const addProduct = () =>
    onEditProduct?.({
      ...productSeed[0],
      id: `product-${Date.now()}`,
      name: "",
      price: 0,
      short: "",
      category: adminCategories[0] || "Danh mục mặc định",
      visible: true,
      __isNew: true
    });

  const addCategory = () => {
    const nextName = `Danh mục mới ${adminCategories.length + 1}`;
    setAdminCategories([nextName, ...adminCategories]);
    setSelectedAdminCategory(nextName);
  };

  const setCategoryVisibility = (categoryName, visible) => {
    if (typeof setProducts !== "function") return;
    setProducts((current) => current.map((item) => (item.category === categoryName ? { ...item, visible } : item)));
  };

  const setProductVisibility = (productId, visible) => {
    if (typeof setProducts !== "function") return;
    setProducts((current) => current.map((item) => (item.id === productId ? { ...item, visible } : item)));
  };

  const openCategoryEditor = (categoryName, setEditingCategoryName, setEditingCategoryDraft) => {
    setEditingCategoryName(categoryName);
    setEditingCategoryDraft(categoryName);
    setCategoryEditorOpen(true);
  };

  const saveCategoryEditor = () => {
    const oldName = editingCategoryName;
    const nextName = String(editingCategoryDraft || "").trim();
    if (!oldName) return;
    if (!nextName) return alert("Vui lòng nhập tên danh mục.");
    const duplicated = adminCategories.some((item) => item === nextName && item !== oldName);
    if (duplicated) return alert("Tên danh mục đã tồn tại.");
    if (nextName === oldName) return setCategoryEditorOpen(false);

    setAdminCategories((current) => current.map((item) => (item === oldName ? nextName : item)));
    if (typeof setProducts === "function") {
      setProducts((current) => current.map((item) => (item.category === oldName ? { ...item, category: nextName } : item)));
    }
    setSelectedAdminCategory((current) => (current === oldName ? nextName : current));
    setCategoryEditorOpen(false);
  };

  const deleteCategoryFromEditor = () => {
    const target = editingCategoryName;
    if (!target) return;
    const nextCategories = adminCategories.filter((item) => item !== target);
    if (!nextCategories.length) return alert("Cần giữ lại ít nhất 1 danh mục.");
    const fallbackCategory = nextCategories[0];
    setAdminCategories(nextCategories);
    if (typeof setProducts === "function") {
      setProducts((current) => current.map((item) => (item.category === target ? { ...item, category: fallbackCategory } : item)));
    }
    setSelectedAdminCategory((current) => (current === target ? fallbackCategory : current));
    setCategoryEditorOpen(false);
  };

  const updateTopping = (id, patch) => setToppings(toppings.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const addTopping = () => setToppings([{ id: `topping-${Date.now()}`, name: "Topping mới", price: 5000 }, ...toppings]);

  const createPreset = () => {
    const nextId = `preset-${Date.now()}`;
    const next = { id: nextId, name: "", required: false, maxSelect: 1, options: [{ id: `opt-${Date.now()}`, name: "", price: 0, active: true }] };
    setEditingPresetId(nextId);
    setEditingPresetDraft(next);
    setGroupEditorOpen(true);
  };

  const addPresetOption = (presetId) => {
    setOptionGroupPresets((current) =>
      current.map((item) => item.id === presetId ? { ...item, options: [...(item.options || []), { id: `opt-${Date.now()}`, name: "Tùy chọn mới", price: 0, active: true }] } : item)
    );
  };

  const updatePresetOption = (presetId, optionId, patch) => {
    setOptionGroupPresets((current) =>
      current.map((item) =>
        item.id === presetId
          ? { ...item, options: (item.options || []).map((opt) => (opt.id === optionId ? { ...opt, ...patch } : opt)) }
          : item
      )
    );
  };

  const removePresetOption = (presetId, optionId) => {
    setOptionGroupPresets((current) =>
      current.map((item) => (item.id === presetId ? { ...item, options: (item.options || []).filter((opt) => opt.id !== optionId) } : item))
    );
  };

  const openPresetEditor = (preset) => {
    setSelectedPresetId(preset.id);
    setEditingPresetId(preset.id);
    setEditingPresetDraft({ ...preset, options: [...(preset.options || [])] });
    setGroupEditorOpen(true);
  };

  const patchEditingPreset = (patch) => setEditingPresetDraft((current) => ({ ...current, ...patch }));
  const patchEditingOption = (optionId, patch) => {
    setEditingPresetDraft((current) => ({ ...current, options: (current?.options || []).map((opt) => (opt.id === optionId ? { ...opt, ...patch } : opt)) }));
  };
  const addEditingOption = () => {
    setEditingPresetDraft((current) => ({ ...current, options: [...(current?.options || []), { id: `opt-${Date.now()}`, name: "", price: 0, active: true }] }));
  };
  const removeEditingOption = (optionId) => {
    setEditingPresetDraft((current) => ({ ...current, options: (current?.options || []).filter((opt) => opt.id !== optionId) }));
  };
  const reorderEditingOptions = (draggedId, targetId) => {
    setEditingPresetDraft((current) => {
      const options = [...(current?.options || [])];
      const fromIndex = options.findIndex((opt) => opt.id === draggedId);
      const toIndex = options.findIndex((opt) => opt.id === targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
      const [picked] = options.splice(fromIndex, 1);
      options.splice(toIndex, 0, picked);
      return { ...current, options };
    });
  };
  const savePresetFromEditor = () => {
    if (!editingPresetDraft) return;
    const normalized = normalizePresetDraft(editingPresetDraft);
    setOptionGroupPresets((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => (item.id === normalized.id ? normalized : item)) : [normalized, ...current];
    });
    setSelectedPresetId(normalized.id);
    setGroupEditorOpen(false);
  };

  const deletePresetFromEditor = () => {
    if (!editingPresetDraft?.id) return;
    const presetId = editingPresetDraft.id;
    const presetName = String(editingPresetDraft.name || "").trim().toLowerCase();

    setOptionGroupPresets((current) => current.filter((item) => item.id !== presetId));

    if (typeof setProducts === "function") {
      setProducts((current) =>
        (Array.isArray(current) ? current : []).map((product) => {
          const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : [];
          const nextGroups = groups.filter((group) => {
            const sourceId = String(group?.sourcePresetId || "");
            const groupName = String(group?.name || "").trim().toLowerCase();
            if (sourceId && sourceId === presetId) return false;
            if (!sourceId && presetName && groupName === presetName) return false;
            return true;
          });
          return nextGroups.length === groups.length ? product : { ...product, optionGroups: nextGroups };
        })
      );
    }

    setSelectedPresetId("");
    setGroupEditorOpen(false);
  };

  return {
    addProduct,
    addCategory,
    setCategoryVisibility,
    setProductVisibility,
    openCategoryEditor,
    saveCategoryEditor,
    deleteCategoryFromEditor,
    updateTopping,
    addTopping,
    createPreset,
    addPresetOption,
    updatePresetOption,
    removePresetOption,
    openPresetEditor,
    patchEditingPreset,
    patchEditingOption,
    addEditingOption,
    removeEditingOption,
    reorderEditingOptions,
    savePresetFromEditor,
    deletePresetFromEditor
  };
}

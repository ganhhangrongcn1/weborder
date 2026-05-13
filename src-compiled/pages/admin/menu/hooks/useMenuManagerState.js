import { useMemo, useState } from "react";
import {
  ALL_CATEGORY,
  buildCategoryStats,
  filterAdminProducts,
  filterPresets
} from "../menuManager.utils.js";

export default function useMenuManagerState({
  products,
  adminCategories,
  optionGroupPresets
}) {
  const [menuTab, setMenuTab] = useState("overview");
  const [productSearch, setProductSearch] = useState("");
  const [selectedAdminCategory, setSelectedAdminCategory] = useState(ALL_CATEGORY);
  const [viewFilter, setViewFilter] = useState("all");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState(optionGroupPresets[0]?.id || "");
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState("");
  const [editingPresetDraft, setEditingPresetDraft] = useState(null);
  const [draggingEditingOptionId, setDraggingEditingOptionId] = useState("");
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryDraft, setEditingCategoryDraft] = useState("");

  const categoryStats = useMemo(() => buildCategoryStats(adminCategories, products), [adminCategories, products]);
  const filteredAdminProducts = useMemo(
    () => filterAdminProducts({ products, productSearch, selectedAdminCategory, viewFilter }),
    [products, productSearch, selectedAdminCategory, viewFilter]
  );
  const filteredPresets = useMemo(() => filterPresets(optionGroupPresets, groupSearch), [optionGroupPresets, groupSearch]);
  const selectedPreset = optionGroupPresets.find((item) => item.id === selectedPresetId) || optionGroupPresets[0] || null;

  return {
    menuTab,
    setMenuTab,
    productSearch,
    setProductSearch,
    selectedAdminCategory,
    setSelectedAdminCategory,
    viewFilter,
    setViewFilter,
    createMenuOpen,
    setCreateMenuOpen,
    groupSearch,
    setGroupSearch,
    selectedPresetId,
    setSelectedPresetId,
    groupEditorOpen,
    setGroupEditorOpen,
    editingPresetId,
    setEditingPresetId,
    editingPresetDraft,
    setEditingPresetDraft,
    draggingEditingOptionId,
    setDraggingEditingOptionId,
    categoryEditorOpen,
    setCategoryEditorOpen,
    editingCategoryName,
    setEditingCategoryName,
    editingCategoryDraft,
    setEditingCategoryDraft,
    categoryStats,
    filteredAdminProducts,
    filteredPresets,
    selectedPreset
  };
}

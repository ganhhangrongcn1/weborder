import { useState } from "react";

export default function useAdminUiState() {
  const [editingProduct, setEditingProduct] = useState(null);
  const [uiDirty, setUiDirty] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [adminGlobalSearch, setAdminGlobalSearch] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");

  return {
    editingProduct,
    setEditingProduct,
    uiDirty,
    setUiDirty,
    dashboardSearch,
    setDashboardSearch,
    adminGlobalSearch,
    setAdminGlobalSearch,
    selectedBranchFilter,
    setSelectedBranchFilter
  };
}

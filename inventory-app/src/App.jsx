import { useState } from "react";
import AppShell from "./components/AppShell.jsx";
import LoginPage from "./components/LoginPage.jsx";
import {
  CatalogPage,
  InventoryPage,
  StaffPage,
  WorkflowPage
} from "./components/InventoryPages.jsx";
import DashboardPage from "./components/DashboardPage.jsx";
import AppLoadingState from "./components/AppLoadingState.jsx";
import { useInventoryApp } from "./hooks/useInventoryApp.js";

export default function App() {
  const inventory = useInventoryApp();
  const [activePage, setActivePage] = useState("dashboard");

  if (!inventory.session) {
    return <LoginPage configured={inventory.configured} onSignIn={inventory.signIn} />;
  }

  let page = <DashboardPage data={inventory.data} onNavigate={setActivePage} />;
  if (activePage === "inventory") page = <InventoryPage data={inventory.data} />;
  if (["transfers", "receipts", "counts", "reports"].includes(activePage)) {
    page = <WorkflowPage page={activePage} data={inventory.data} onCreateReceipt={inventory.createReceipt} />;
  }
  if (activePage === "catalog") {
    page = <CatalogPage data={inventory.data} onCreate={inventory.createCatalogEntry} onSaveNorm={inventory.updateInventoryNorm} />;
  }
  if (activePage === "staff") page = <StaffPage data={inventory.data} />;

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      role={inventory.currentRole}
      warehouses={inventory.data.warehouses}
      selectedWarehouseId={inventory.selectedWarehouseId}
      onSelectWarehouse={inventory.selectWarehouse}
      onSignOut={inventory.signOut}
    >
      {inventory.error ? (
        <div className="error-banner" role="alert">
          <strong>Chưa tải được dữ liệu kho.</strong>
          <span>{inventory.error}</span>
          <button onClick={inventory.reload}>Thử lại</button>
        </div>
      ) : null}
      {inventory.loading ? <AppLoadingState /> : page}
    </AppShell>
  );
}


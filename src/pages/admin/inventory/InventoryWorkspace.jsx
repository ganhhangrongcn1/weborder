import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import useInventoryDashboard from "../../../hooks/useInventoryDashboard.js";
import useInventoryMasterData from "../../../hooks/useInventoryMasterData.js";
import useInventoryWarehouses from "../../../hooks/useInventoryWarehouses.js";
import useInventoryWarehouseDrafts from "../../../hooks/useInventoryWarehouseDrafts.js";
import useInventoryDocuments from "../../../hooks/useInventoryDocuments.js";
import useInventoryLedger from "../../../hooks/useInventoryLedger.js";
import useInventoryStockFlowReport from "../../../hooks/useInventoryStockFlowReport.js";
import useInventoryStockReport from "../../../hooks/useInventoryStockReport.js";
import useInventoryLotReport from "../../../hooks/useInventoryLotReport.js";
import useInventoryAlerts from "../../../hooks/useInventoryAlerts.js";
import useInventoryCounts from "../../../hooks/useInventoryCounts.js";
import useInventoryBoms from "../../../hooks/useInventoryBoms.js";
import useInventoryProductionOrders from "../../../hooks/useInventoryProductionOrders.js";
import useInventorySalesConfiguration from "../../../hooks/useInventorySalesConfiguration.js";
import useInventoryCostAnalysis from "../../../hooks/useInventoryCostAnalysis.js";
import useInventoryOpeningBalances from "../../../hooks/useInventoryOpeningBalances.js";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";
import { filterInventoryItemsByWarehouse } from "../../../services/inventoryMasterDataService.js";
import { getInventoryRoute } from "./inventoryNavigation.js";
import { getInventoryAccessPolicy, getInventoryScopedWarehouses } from "./inventoryAccessPolicy.js";
import InventoryWarehouseManager from "./InventoryWarehouseManager.jsx";
import InventoryCatalogManager from "./InventoryCatalogManager.jsx";
import InventoryMasterDataManager from "./InventoryMasterDataManager.jsx";
import InventoryDocumentManager from "./InventoryDocumentManager.jsx";
import InventoryLedger from "./InventoryLedger.jsx";
import InventoryStockFlowReport from "./InventoryStockFlowReport.jsx";
import InventoryStockReport from "./InventoryStockReport.jsx";
import InventoryLotReport from "./InventoryLotReport.jsx";
import InventoryAlertCenter from "./InventoryAlertCenter.jsx";
import InventoryCountManager from "./InventoryCountManager.jsx";
import InventoryDashboard from "./InventoryDashboard.jsx";
import InventoryBomManager from "./InventoryBomManager.jsx";
import InventoryProductionOrderManager from "./InventoryProductionOrderManager.jsx";
import InventorySalesConfiguration from "./InventorySalesConfiguration.jsx";
import InventorySalesReconciliation from "./InventorySalesReconciliation.jsx";
import InventoryCostAnalysis from "./InventoryCostAnalysis.jsx";
import InventoryOpeningBalanceManager from "./InventoryOpeningBalanceManager.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";

function rowMatchesWorkspaceWarehouse(row = {}, warehouseId = "") {
  if (!warehouseId) return true;
  return [row.warehouseId, row.sourceWarehouseId, row.destinationWarehouseId, row.defaultWarehouseId]
    .filter(Boolean)
    .includes(warehouseId);
}

function filterWorkspaceRows(rows = [], warehouseId = "") {
  return warehouseId ? rows.filter((row) => rowMatchesWorkspaceWarehouse(row, warehouseId)) : rows;
}

function scopeDashboardData(data = {}, warehouseId = "") {
  if (!warehouseId) return data;
  const warehouse = (data.warehouses || []).find((row) => row.id === warehouseId);
  if (!warehouse) return { ...data, actions: [], warehouses: [], activity7d: null };
  return {
    ...data,
    kpis: {
      inventoryValue: warehouse.inventoryValue,
      outOfStockCount: warehouse.outOfStockCount,
      reorderCount: warehouse.reorderCount,
      expiredCount: 0,
      expiringCount: warehouse.expiryCount,
      pendingCount: warehouse.pendingCount
    },
    activity7d: null,
    actions: (data.actions || []).filter((row) => rowMatchesWorkspaceWarehouse(row, warehouseId)),
    warehouses: [warehouse]
  };
}

function InventoryAccessGate({ accessPolicy, children }) {
  if (accessPolicy.allowed) return children;

  return (
    <section className="inventory-access-denied" role="alert">
      <span className="inventory-access-denied__icon"><Icon name="warning" size={24} /></span>
      <div>
        <p className="inventory-eyebrow">Phạm vi được bảo vệ</p>
        <h2>Tài khoản chưa có quyền mở Quản lý kho</h2>
        <p>
          {accessPolicy.message}
        </p>
      </div>
    </section>
  );
}

function InventoryConnectionState({ status = "disconnected", error = "", isStale = false, onRetry }) {
  if (status === "loading") {
    return <div className="inventory-state inventory-state--loading" role="status">Đang tải dữ liệu kho…</div>;
  }

  if (status === "error") {
    return (
      <div className="inventory-state inventory-state--error" role="alert">
        <div><strong>Chưa tải được dữ liệu kho</strong><span>{error || "Kết nối tạm thời gặp sự cố."}</span></div>
        {onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="inventory-state inventory-state--stale" role="status">
        <div><strong>Dữ liệu đang hiển thị có thể đã cũ</strong><span>Hãy tải lại trước khi ra quyết định vận hành.</span></div>
        {onRetry ? <button type="button" onClick={onRetry}>Tải lại</button> : null}
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="inventory-state inventory-state--ready" role="status">
        <span><Icon name="check" size={18} /></span>
        <div><strong>Đã kết nối dữ liệu kho</strong><small>Dữ liệu và thao tác được bảo vệ theo quyền tài khoản hiện tại.</small></div>
        {onRetry ? <button type="button" onClick={onRetry}>Tải lại</button> : null}
      </div>
    );
  }

  if (status === "setup") {
    return (
      <div className="inventory-state inventory-state--setup" role="status">
        <span><Icon name="gear" size={18} /></span>
        <div><strong>Chưa mở dữ liệu kho trên hệ thống đang chạy</strong><small>{error || "Cần duyệt migration và RLS trước khi kết nối."}</small></div>
        {onRetry ? <button type="button" onClick={onRetry}>Kiểm tra lại</button> : null}
      </div>
    );
  }

  return (
    <div className="inventory-state inventory-state--setup" role="status">
      <span><Icon name="gear" size={18} /></span>
      <div>
        <strong>Giao diện Phase 2 — chưa kết nối dữ liệu thật</strong>
        <small>Không có thao tác nào ở màn hình này làm thay đổi tồn kho hoặc luồng đang chạy.</small>
      </div>
    </div>
  );
}

function InventoryPageEmptyState({ route }) {
  return (
    <section className="inventory-empty-card">
      <span className="inventory-empty-card__icon"><Icon name={route.icon} size={28} /></span>
      <p className="inventory-eyebrow">Khung vận hành đã sẵn sàng</p>
      <h2>{route.label}</h2>
      <p>{route.description}</p>
      <div className="inventory-empty-card__note">
        Dữ liệu và thao tác nghiệp vụ sẽ được nối ở phase tiếp theo sau khi migration Kho được duyệt triển khai.
      </div>
      <button type="button" disabled>Thêm mới — mở ở Phase 3</button>
    </section>
  );
}

export default function InventoryWorkspace({
  inventoryPage = "dashboard",
  adminProfile = null,
  isSupabaseAdminMode = false,
  branches = [],
  products = [],
  toppings = [],
  inventoryAccessPolicy = null,
  onInventoryWarehouseChange,
  dataStatus = "disconnected",
  dataError = "",
  dataIsStale = false,
  onRetry
}) {
  const currentRoute = getInventoryRoute(inventoryPage);
  const accessPolicy = inventoryAccessPolicy || getInventoryAccessPolicy({
    adminProfile,
    isSupabaseAdminMode,
    branches
  });
  const isWarehousePage = currentRoute.page === "warehouses";
  const isDashboardPage = currentRoute.page === "dashboard";
  const isLedgerPage = currentRoute.page === "ledger";
  const isStockFlowPage = currentRoute.page === "stock-flow";
  const isReportPage = currentRoute.page === "reports";
  const isLotPage = currentRoute.page === "lots";
  const isAlertPage = currentRoute.page === "alerts";
  const isCostAnalysisPage = currentRoute.page === "cost-analysis";
  const isCountPage = currentRoute.page === "counts";
  const isBomPage = currentRoute.page === "boms";
  const isProductionPage = currentRoute.page === "production-orders";
  const isSalesRecipePage = currentRoute.page === "sales-recipes";
  const isReconciliationPage = currentRoute.page === "reconciliation";
  const isOpeningBalancePage = currentRoute.page === "opening-balances";
  const documentDomain = ["receipts", "issues", "transfers", "disposals", "requisitions", "adjustments"].includes(currentRoute.page)
    ? currentRoute.page
    : "";
  const masterDataDomain = ["items", "item-categories", "units", "suppliers"].includes(currentRoute.page)
    ? currentRoute.page
    : "";
  const canLoadBomScope = accessPolicy.allowed || isBomPage || isProductionPage || isSalesRecipePage;
  const warehouseState = useInventoryWarehouses({
    enabled: accessPolicy.allowed || isCostAnalysisPage || isBomPage || isProductionPage || isSalesRecipePage,
    branchUuid: accessPolicy.scope === "branch" ? accessPolicy.branchUuid : ""
  });
  const [workspaceWarehouseId, setWorkspaceWarehouseId] = useState("");
  const warehouseScopeInitialized = useRef(false);
  const scopedWarehouses = getInventoryScopedWarehouses(warehouseState.warehouses, accessPolicy);
  useEffect(() => {
    if (warehouseScopeInitialized.current || warehouseState.status !== "ready") return;
    if (accessPolicy.scope === "branch") {
      setWorkspaceWarehouseId(scopedWarehouses[0]?.id || "");
    } else if (accessPolicy.scope === "warehouse") {
      const centralWarehouse = scopedWarehouses.find((warehouse) => warehouse.warehouseType === "central") || scopedWarehouses[0];
      setWorkspaceWarehouseId(centralWarehouse?.id || "");
    }
    warehouseScopeInitialized.current = true;
  }, [accessPolicy.scope, scopedWarehouses, warehouseState.status]);
  useEffect(() => {
    if (warehouseState.status !== "ready") return;
    if (!workspaceWarehouseId && ["branch", "warehouse"].includes(accessPolicy.scope)) return;
    onInventoryWarehouseChange?.(workspaceWarehouseId);
  }, [accessPolicy.scope, onInventoryWarehouseChange, warehouseState.status, workspaceWarehouseId]);
  const activeWarehouses = workspaceWarehouseId
    ? scopedWarehouses.filter((warehouse) => warehouse.id === workspaceWarehouseId)
    : scopedWarehouses;
  const masterDataState = useInventoryMasterData({
    enabled: Boolean(masterDataDomain) && accessPolicy.allowed,
    domain: masterDataDomain
  });
  const itemUnitsState = useInventoryMasterData({
    enabled: isCostAnalysisPage || ((currentRoute.page === "items" || Boolean(documentDomain) || isOpeningBalancePage || isLedgerPage || isStockFlowPage || isReportPage || isLotPage || isAlertPage || isCountPage || isReconciliationPage) && accessPolicy.allowed) || isBomPage || isProductionPage || isSalesRecipePage,
    domain: "units"
  });
  const itemCategoriesState = useInventoryMasterData({
    enabled: currentRoute.page === "items" && accessPolicy.allowed,
    domain: "item-categories"
  });
  const documentItemsState = useInventoryMasterData({
    enabled: isCostAnalysisPage || ((Boolean(documentDomain) || isOpeningBalancePage || isLedgerPage || isStockFlowPage || isReportPage || isLotPage || isAlertPage || isCountPage || isReconciliationPage) && accessPolicy.allowed) || isBomPage || isProductionPage || isSalesRecipePage,
    domain: "items"
  });
  const documentSuppliersState = useInventoryMasterData({
    enabled: documentDomain === "receipts" && accessPolicy.allowed,
    domain: "suppliers"
  });
  const documentState = useInventoryDocuments({
    enabled: Boolean(documentDomain) && accessPolicy.allowed,
    domain: documentDomain,
    warehouseId: workspaceWarehouseId
  });
  const ledgerState = useInventoryLedger({
    enabled: isLedgerPage && accessPolicy.allowed,
    warehouseId: workspaceWarehouseId
  });
  const stockFlowState = useInventoryStockFlowReport({
    enabled: isStockFlowPage && accessPolicy.allowed,
    warehouseId: workspaceWarehouseId
  });
  const stockReportState = useInventoryStockReport({
    enabled: isReportPage && accessPolicy.allowed
  });
  const lotReportState = useInventoryLotReport({
    enabled: isLotPage && accessPolicy.allowed,
    warehouseIds: activeWarehouses.map((warehouse) => warehouse.id)
  });
  const alertState = useInventoryAlerts({
    enabled: isAlertPage && accessPolicy.allowed,
    warehouseIds: activeWarehouses.map((warehouse) => warehouse.id)
  });
  const costAnalysisState = useInventoryCostAnalysis({
    enabled: isCostAnalysisPage,
    warehouseIds: activeWarehouses.map((warehouse) => warehouse.id),
    allowLocalAdmin: !isSupabaseAdminMode && accessPolicy.scope === "global"
  });
  const countState = useInventoryCounts({
    enabled: isCountPage && accessPolicy.allowed
  });
  const openingBalanceState = useInventoryOpeningBalances({
    enabled: isOpeningBalancePage && accessPolicy.allowed
  });
  const dashboardState = useInventoryDashboard({
    enabled: isDashboardPage && accessPolicy.allowed
  });
  const bomState = useInventoryBoms({
    enabled: (isBomPage || isProductionPage) && canLoadBomScope,
    items: documentItemsState.rows,
    units: itemUnitsState.rows,
    warehouses: warehouseState.warehouses
  });
  const productionState = useInventoryProductionOrders({
    enabled: isProductionPage && canLoadBomScope
  });
  const menuEntities = useMemo(() => [
    ...products.filter((row) => row && row.id && row.isActive !== false).map((row) => ({
      id: String(row.id),
      name: row.name || "Món chưa đặt tên",
      price: Number(row.price || 0),
      type: "product",
      category: row.category || row.badge || "Món khác"
    })),
    ...toppings.filter((row) => row && row.id && row.isActive !== false).map((row) => ({
      id: String(row.id),
      name: row.name || "Topping chưa đặt tên",
      price: Number(row.price || 0),
      type: "topping",
      category: "Topping"
    }))
  ], [products, toppings]);
  const salesConfigurationState = useInventorySalesConfiguration({
    enabled: (isSalesRecipePage && canLoadBomScope) || (isReconciliationPage && accessPolicy.allowed),
    loadConfiguration: isSalesRecipePage,
    loadSalesEvents: isReconciliationPage,
    menuEntities,
    items: documentItemsState.rows,
    units: itemUnitsState.rows
  });
  const warehouseDraftState = useInventoryWarehouseDrafts();
  useEffect(() => {
    if (warehouseState.status !== "ready") return;
    warehouseDraftState.reconcilePublishedDrafts(warehouseState.warehouses);
  }, [
    warehouseDraftState.reconcilePublishedDrafts,
    warehouseState.loadedAt,
    warehouseState.status,
    warehouseState.warehouses
  ]);
  const scopedBranches = accessPolicy.scope === "branch"
    ? branches.filter((branch) => resolveBranchFromCandidates([accessPolicy.branchUuid], [branch]))
    : branches;
  const warehouseSelectionLocked = accessPolicy.scope === "branch";
  const visibleWarehouses = [
    ...scopedWarehouses,
    ...(warehouseSelectionLocked ? [] : warehouseDraftState.drafts)
  ];
  const workspaceItems = filterInventoryItemsByWarehouse(documentItemsState.rows, workspaceWarehouseId);
  const workspaceMasterRows = masterDataDomain === "items"
    ? filterInventoryItemsByWarehouse(masterDataState.rows, workspaceWarehouseId)
    : masterDataState.rows;
  const workspaceWarehouse = scopedWarehouses.find((warehouse) => warehouse.id === workspaceWarehouseId);
  const workspaceScopeLabel = workspaceWarehouse?.name || accessPolicy.scopeLabel;
  const workspaceDashboardData = scopeDashboardData(dashboardState.data, workspaceWarehouseId);
  const effectiveAccessPolicy = isCostAnalysisPage
    ? costAnalysisState.permissions?.canView
      ? {
          ...accessPolicy,
          allowed: true,
          scope: accessPolicy.scope === "blocked" ? "warehouse" : accessPolicy.scope,
          scopeLabel: accessPolicy.scope === "blocked" ? "Kho Tổng được cấp" : accessPolicy.scopeLabel,
          message: ""
        }
      : {
          ...accessPolicy,
          allowed: false,
          message: costAnalysisState.message || "Chỉ Admin toàn hệ thống hoặc Quản lý Kho Tổng được xem giá vốn và đối chiếu."
        }
    : !accessPolicy.allowed
    && (isBomPage || isProductionPage || isSalesRecipePage)
    && (isProductionPage
      ? productionState.status === "ready" && productionState.permissions?.canManage
      : isSalesRecipePage
        ? salesConfigurationState.status === "ready" && salesConfigurationState.permissions?.canManage
        : bomState.status === "ready" && bomState.permissions?.canManage)
    ? {
        ...accessPolicy,
        allowed: true,
        role: "central_manager",
        scope: "warehouse",
        scopeLabel: warehouseState.warehouses.map((warehouse) => warehouse.name).filter(Boolean).join(", ") || "Kho Tổng được cấp",
        message: ""
      }
    : accessPolicy;
  const activeDataState = isDashboardPage
    ? dashboardState
    : isWarehousePage
    ? warehouseState
    : isLedgerPage
      ? ledgerState
    : isStockFlowPage
      ? stockFlowState
    : isReportPage
      ? stockReportState
    : isLotPage
      ? lotReportState
    : isAlertPage
      ? alertState
    : isCostAnalysisPage
      ? costAnalysisState
    : isCountPage
      ? countState
    : isOpeningBalancePage
      ? openingBalanceState
    : isBomPage
      ? bomState
    : isProductionPage
      ? productionState
    : isSalesRecipePage || isReconciliationPage
      ? salesConfigurationState
    : documentDomain
      ? documentState
    : masterDataDomain
      ? masterDataState
      : null;
  const connectionStatus = activeDataState?.status || dataStatus;
  const connectionError = activeDataState?.message || dataError;
  const retryConnection = activeDataState?.refresh || onRetry;
  const canManageGlobalData = accessPolicy.scope === "global" || accessPolicy.canManageInventory === true;
  const canWriteWarehouses = canManageGlobalData
    && warehouseState.status === "ready"
    && warehouseState.writeEnabled;
  const canWriteMasterData = canManageGlobalData
    && masterDataState.status === "ready"
    && masterDataState.writeEnabled;
  const canWriteDocuments = accessPolicy.allowed
    && documentState.status === "ready"
    && warehouseState.status === "ready"
    && documentItemsState.status === "ready"
    && (documentDomain !== "receipts" || documentSuppliersState.status === "ready")
    && documentState.writeEnabled;
  const canWriteOpeningBalances = canManageGlobalData
    && openingBalanceState.status === "ready"
    && warehouseState.status === "ready"
    && documentItemsState.status === "ready"
    && itemUnitsState.status === "ready"
    && openingBalanceState.writeEnabled;
  const canWriteBoms = (accessPolicy.scope === "global" || Boolean(bomState.permissions?.canManage))
    && bomState.status === "ready"
    && warehouseState.status === "ready"
    && documentItemsState.status === "ready"
    && itemUnitsState.status === "ready"
    && bomState.writeEnabled;
  const canWriteProduction = (accessPolicy.scope === "global" || Boolean(productionState.permissions?.canManage))
    && productionState.status === "ready"
    && bomState.status === "ready"
    && warehouseState.status === "ready"
    && documentItemsState.status === "ready"
    && itemUnitsState.status === "ready"
    && productionState.writeEnabled;
  const canWriteSalesConfiguration = (accessPolicy.scope === "global" || Boolean(salesConfigurationState.permissions?.canManage))
    && salesConfigurationState.status === "ready"
    && documentItemsState.status === "ready"
    && itemUnitsState.status === "ready"
    && salesConfigurationState.writeEnabled;
  const canRetrySalesEvents = accessPolicy.allowed
    && salesConfigurationState.status === "ready"
    && salesConfigurationState.writeEnabled;
  const publishWarehouseDrafts = async () => {
    const result = await warehouseState.publishDrafts(warehouseDraftState.drafts);
    warehouseDraftState.removeDrafts(result.publishedDraftIds);
    return result;
  };

  return (
    <InventoryAccessGate accessPolicy={effectiveAccessPolicy}>
      <section className="inventory-workspace">
        <header className="inventory-page-head">
          <div>
            <p className="inventory-eyebrow">Quản lý kho</p>
            <h1>{currentRoute.label}</h1>
            <p>{currentRoute.description}</p>
          </div>
          <div className="inventory-scope-badge">
            <Icon name="eye" size={16} />
            <span>Phạm vi: <strong>{workspaceScopeLabel}</strong></span>
          </div>
          {accessPolicy.scope === "warehouse" && scopedWarehouses.length ? (
            <label className="inventory-page-scope">
              <span>Kho đang thao tác</span>
              <InventorySearchableSelect value={workspaceWarehouseId} onChange={(event) => setWorkspaceWarehouseId(event.target.value)} aria-label="Chọn kho đang thao tác">
                <option value="">Tất cả kho được phép</option>
                {scopedWarehouses.filter((warehouse) => warehouse.isActive !== false).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </InventorySearchableSelect>
            </label>
          ) : null}
        </header>

        <InventoryConnectionState
          status={connectionStatus}
          error={connectionError}
          isStale={dataIsStale}
          onRetry={retryConnection}
        />

        {isDashboardPage
          ? <InventoryDashboard data={workspaceDashboardData} warehouseScoped={Boolean(workspaceWarehouseId)} />
          : isOpeningBalancePage
            ? <InventoryOpeningBalanceManager
                rows={filterWorkspaceRows(openingBalanceState.rows, workspaceWarehouseId)}
                warehouses={activeWarehouses}
                items={workspaceItems}
                units={itemUnitsState.rows}
                canWrite={canWriteOpeningBalances}
                mutationStatus={openingBalanceState.mutationStatus}
                mutationMessage={openingBalanceState.mutationMessage}
                onCreate={openingBalanceState.create}
              />
          : currentRoute.page === "warehouses"
            ? <InventoryWarehouseManager
                warehouses={visibleWarehouses}
                branches={branches}
                canWrite={canWriteWarehouses}
                onSave={canWriteWarehouses ? warehouseState.save : ({ input }) => warehouseDraftState.createDraft(input)}
                onArchive={warehouseState.archive}
                onPublishDrafts={publishWarehouseDrafts}
              />
            : masterDataDomain
              ? ["items", "suppliers"].includes(masterDataDomain)
                ? <InventoryCatalogManager domain={masterDataDomain} rows={workspaceMasterRows} allRows={masterDataState.rows} units={itemUnitsState.rows} categories={itemCategoriesState.rows} warehouses={scopedWarehouses} selectedWarehouseId={workspaceWarehouseId} canWrite={canWriteMasterData} onSave={masterDataState.save} onArchive={masterDataState.archive} />
                : <InventoryMasterDataManager domain={masterDataDomain} rows={masterDataState.rows} canWrite={canWriteMasterData} onSave={masterDataState.save} onArchive={masterDataState.archive} />
              : documentDomain
                ? <InventoryDocumentManager
                    domain={documentDomain}
                    rows={filterWorkspaceRows(documentState.rows, workspaceWarehouseId)}
                    warehouses={activeWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    suppliers={documentSuppliersState.rows}
                    canWrite={canWriteDocuments}
                    canReverseReceipts={Boolean(documentState.permissions?.canReverseReceipts)}
                    canApproveDisposals={Boolean(documentState.permissions?.canApproveDisposals)}
                    canApproveAdjustments={Boolean(documentState.permissions?.canApproveAdjustments)}
                    mutationStatus={documentState.mutationStatus}
                    mutationMessage={documentState.mutationMessage}
                    filters={documentState.filters}
                    totalCount={documentState.totalCount}
                    pageCount={documentState.pageCount}
                    onFiltersChange={documentState.updateFilters}
                    onSave={documentState.saveDraft}
                    onDeleteDraft={documentState.deleteDraft}
                    onSubmit={documentState.submit}
                    onComplete={documentState.complete}
                    onReverseReceipt={documentState.reverseReceipt}
                    onApproveAdjustment={documentState.approveAdjustment}
                    onDispatchTransfer={documentState.dispatchTransfer}
                    onReceiveTransfer={documentState.receiveTransfer}
                    onCompleteTransfer={documentState.completeTransfer}
                    onApproveRequisition={documentState.approveRequisition}
                    onRejectRequisition={documentState.rejectRequisition}
                    onCreateRequisitionTransfer={documentState.createRequisitionTransfer}
                    onFulfillRequisition={documentState.fulfillRequisition}
                    requestCreationMode={canManageGlobalData ? "admin_on_behalf" : "warehouse_self"}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                  />
              : isLedgerPage
                ? <InventoryLedger
                    rows={filterWorkspaceRows(ledgerState.rows, workspaceWarehouseId)}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    filters={ledgerState.filters}
                    totalCount={ledgerState.totalCount}
                    pageCount={ledgerState.pageCount}
                    summary={ledgerState.summary}
                    summaryLimited={ledgerState.summaryLimited}
                    onFiltersChange={(patch) => { if (Object.prototype.hasOwnProperty.call(patch, "warehouseId")) setWorkspaceWarehouseId(patch.warehouseId); ledgerState.updateFilters(patch); }}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                  />
              : isStockFlowPage
                ? <InventoryStockFlowReport
                    rows={filterWorkspaceRows(stockFlowState.rows, workspaceWarehouseId)}
                    summary={stockFlowState.summary}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    filters={stockFlowState.filters}
                    totalCount={stockFlowState.totalCount}
                    pageCount={stockFlowState.pageCount}
                    loading={stockFlowState.status === "loading"}
                    onFiltersChange={(patch) => { if (Object.prototype.hasOwnProperty.call(patch, "warehouseId")) setWorkspaceWarehouseId(patch.warehouseId); stockFlowState.updateFilters(patch); }}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                  />
              : isReportPage
                ? <InventoryStockReport
                    rows={filterWorkspaceRows(stockReportState.rows, workspaceWarehouseId)}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    limited={stockReportState.limited}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                    selectedWarehouseId={workspaceWarehouseId}
                    onWarehouseChange={setWorkspaceWarehouseId}
                  />
              : isLotPage
                ? <InventoryLotReport
                    rows={filterWorkspaceRows(lotReportState.rows, workspaceWarehouseId)}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    limited={lotReportState.limited}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                    selectedWarehouseId={workspaceWarehouseId}
                    onWarehouseChange={setWorkspaceWarehouseId}
                  />
              : isAlertPage
                ? <InventoryAlertCenter
                    sources={alertState.sources}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    limited={alertState.limited}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                    selectedWarehouseId={workspaceWarehouseId}
                    onWarehouseChange={setWorkspaceWarehouseId}
                  />
              : isCostAnalysisPage
                ? <InventoryCostAnalysis
                    salesRows={filterWorkspaceRows(costAnalysisState.salesRows, workspaceWarehouseId)}
                    productionRows={filterWorkspaceRows(costAnalysisState.productionRows, workspaceWarehouseId)}
                    warehouses={scopedWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    filters={costAnalysisState.filters}
                    loading={costAnalysisState.status === "loading"}
                    message={costAnalysisState.message}
                    hasMore={costAnalysisState.hasMore}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                    onFiltersChange={(patch) => { if (Object.prototype.hasOwnProperty.call(patch, "warehouseId")) setWorkspaceWarehouseId(patch.warehouseId); costAnalysisState.updateFilters(patch); }}
                  />
              : isCountPage
                ? <InventoryCountManager
                    rows={filterWorkspaceRows(countState.rows, workspaceWarehouseId)}
                    warehouses={activeWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    canWrite={countState.writeEnabled && countState.status === "ready"}
                    canManage={Boolean(countState.permissions?.canManage)}
                    canCancel={Boolean(countState.permissions?.canCancel)}
                    canCount={Boolean(countState.permissions?.canCount)}
                    mutationStatus={countState.mutationStatus}
                    mutationMessage={countState.mutationMessage}
                    onCreateAndStart={countState.createAndStart}
                    onRecordAndSubmit={countState.recordAndSubmit}
                    onApproveAndComplete={countState.approveAndComplete}
                    onCancel={countState.cancel}
                    onCompleteApproved={countState.completeApproved}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                  />
              : isBomPage
                ? <InventoryBomManager
                    rows={filterWorkspaceRows(bomState.rows, workspaceWarehouseId)}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    warehouses={activeWarehouses}
                    canWrite={canWriteBoms}
                    scopeLabel={workspaceScopeLabel}
                    mutationStatus={bomState.mutationStatus}
                    mutationMessage={bomState.mutationMessage}
                    onSave={bomState.saveDraft}
                    onActivate={bomState.activate}
                    onDelete={bomState.deleteDraft}
                    onArchive={bomState.archive}
                  />
              : isProductionPage
                ? <InventoryProductionOrderManager
                    rows={filterWorkspaceRows(productionState.rows, workspaceWarehouseId)}
                    boms={bomState.rows}
                    warehouses={activeWarehouses}
                    canWrite={canWriteProduction}
                    mutationStatus={productionState.mutationStatus}
                    mutationMessage={productionState.mutationMessage}
                    onSave={productionState.saveDraft}
                    onStart={productionState.start}
                    onComplete={productionState.complete}
                    onCancel={productionState.cancel}
                    onDeleteDraft={productionState.deleteDraft}
                    warehouseSelectionLocked={warehouseSelectionLocked}
                  />
              : isReconciliationPage
                ? <InventorySalesReconciliation
                    rows={filterWorkspaceRows(salesConfigurationState.salesEvents, workspaceWarehouseId)}
                    branches={scopedBranches}
                    warehouses={activeWarehouses}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    canWrite={canRetrySalesEvents}
                    mutationStatus={salesConfigurationState.mutationStatus}
                    mutationMessage={salesConfigurationState.mutationMessage}
                    message={salesConfigurationState.salesEventMessage}
                    loading={salesConfigurationState.salesEventStatus === "loading"}
                    hasMore={salesConfigurationState.salesEventHasMore}
                    filters={salesConfigurationState.salesEventFilters}
                    onFiltersChange={salesConfigurationState.updateSalesEventFilters}
                    onRetry={salesConfigurationState.retrySalesEvent}
                  />
              : isSalesRecipePage
                ? <InventorySalesConfiguration
                    recipes={salesConfigurationState.recipes}
                    mappings={salesConfigurationState.mappings}
                    candidates={salesConfigurationState.candidates}
                    candidateMessage={salesConfigurationState.candidateMessage}
                    menuEntities={menuEntities}
                    items={workspaceItems}
                    units={itemUnitsState.rows}
                    branches={scopedBranches}
                    warehouses={activeWarehouses}
                    averageCosts={salesConfigurationState.averageCosts}
                    canWrite={canWriteSalesConfiguration}
                    canManageWarehouseDefaults={canWriteWarehouses}
                    mutationStatus={salesConfigurationState.mutationStatus}
                    mutationMessage={salesConfigurationState.mutationMessage}
                    warehouseMutationStatus={warehouseState.mutationStatus}
                    warehouseMutationMessage={warehouseState.mutationMessage}
                    onSaveRecipe={salesConfigurationState.saveRecipe}
                    onActivateRecipe={salesConfigurationState.activateRecipe}
                    onDeactivateRecipe={salesConfigurationState.deactivateRecipe}
                    onDeleteRecipe={salesConfigurationState.deleteRecipe}
                    onSaveMapping={salesConfigurationState.saveMapping}
                    onDeleteMapping={salesConfigurationState.deleteMapping}
                    onSetDefaultWarehouse={warehouseState.setBranchDefault}
                  />
              : <InventoryPageEmptyState route={currentRoute} />}
      </section>
    </InventoryAccessGate>
  );
}

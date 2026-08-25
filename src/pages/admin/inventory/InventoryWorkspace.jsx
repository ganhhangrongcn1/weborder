import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import useInventoryMasterData from "../../../hooks/useInventoryMasterData.js";
import useInventoryWarehouses from "../../../hooks/useInventoryWarehouses.js";
import useInventoryWarehouseDrafts from "../../../hooks/useInventoryWarehouseDrafts.js";
import useInventoryDocuments from "../../../hooks/useInventoryDocuments.js";
import { getInventoryRoute } from "./inventoryNavigation.js";
import { getInventoryAccessPolicy } from "./inventoryAccessPolicy.js";
import InventoryWarehouseManager from "./InventoryWarehouseManager.jsx";
import InventoryCatalogManager from "./InventoryCatalogManager.jsx";
import InventoryMasterDataManager from "./InventoryMasterDataManager.jsx";
import InventoryDocumentManager from "./InventoryDocumentManager.jsx";

const DASHBOARD_GROUPS = [
  {
    title: "Xây dữ liệu",
    description: "Tạo nền kho, nguyên vật liệu, đơn vị tính và nhà cung cấp trước khi phát sinh chứng từ.",
    pages: ["warehouses", "items", "item-categories", "units", "suppliers"]
  },
  {
    title: "Xuất nhập kho",
    description: "Vận hành nhập, xuất, chuyển kho, hủy hàng và yêu cầu cấp hàng theo đúng trạng thái chứng từ.",
    pages: ["receipts", "issues", "transfers", "disposals", "requisitions"]
  },
  {
    title: "Báo cáo và kiểm soát",
    description: "Giải thích số tồn bằng sổ kho, kiểm kê, báo cáo và đối chiếu đơn bán.",
    pages: ["counts", "ledger", "reports", "reconciliation"]
  }
];

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

function InventoryDashboard() {
  return (
    <div className="inventory-module-grid">
      {DASHBOARD_GROUPS.map((group) => (
        <section key={group.title} className="inventory-module-card">
          <div className="inventory-module-card__head">
            <span><Icon name="check" size={18} /></span>
            <div><h3>{group.title}</h3><p>{group.description}</p></div>
          </div>
          <div className="inventory-module-card__links">
            {group.pages.map((page) => {
              const route = getInventoryRoute(page);
              return <NavLink key={route.page} to={route.path}>{route.label}<span>→</span></NavLink>;
            })}
          </div>
        </section>
      ))}
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
  inventoryAccessPolicy = null,
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
  const documentDomain = ["receipts", "issues", "transfers", "disposals", "requisitions"].includes(currentRoute.page)
    ? currentRoute.page
    : "";
  const masterDataDomain = ["items", "item-categories", "units", "suppliers"].includes(currentRoute.page)
    ? currentRoute.page
    : "";
  const warehouseState = useInventoryWarehouses({
    enabled: (isWarehousePage || Boolean(documentDomain)) && accessPolicy.allowed,
    branchUuid: accessPolicy.scope === "branch" ? accessPolicy.branchUuid : ""
  });
  const masterDataState = useInventoryMasterData({
    enabled: Boolean(masterDataDomain) && accessPolicy.allowed,
    domain: masterDataDomain
  });
  const itemUnitsState = useInventoryMasterData({
    enabled: currentRoute.page === "items" && accessPolicy.allowed,
    domain: "units"
  });
  const itemCategoriesState = useInventoryMasterData({
    enabled: currentRoute.page === "items" && accessPolicy.allowed,
    domain: "item-categories"
  });
  const documentItemsState = useInventoryMasterData({
    enabled: Boolean(documentDomain) && accessPolicy.allowed,
    domain: "items"
  });
  const documentSuppliersState = useInventoryMasterData({
    enabled: documentDomain === "receipts" && accessPolicy.allowed,
    domain: "suppliers"
  });
  const documentState = useInventoryDocuments({
    enabled: Boolean(documentDomain) && accessPolicy.allowed,
    domain: documentDomain
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
  const visibleWarehouses = [...warehouseState.warehouses, ...warehouseDraftState.drafts];
  const activeDataState = isWarehousePage
    ? warehouseState
    : documentDomain
      ? documentState
    : masterDataDomain
      ? masterDataState
      : null;
  const connectionStatus = activeDataState?.status || dataStatus;
  const connectionError = activeDataState?.message || dataError;
  const retryConnection = activeDataState?.refresh || onRetry;
  const canManageGlobalData = accessPolicy.scope === "global";
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
  const publishWarehouseDrafts = async () => {
    const result = await warehouseState.publishDrafts(warehouseDraftState.drafts);
    warehouseDraftState.removeDrafts(result.publishedDraftIds);
    return result;
  };

  return (
    <InventoryAccessGate accessPolicy={accessPolicy}>
      <section className="inventory-workspace">
        <header className="inventory-page-head">
          <div>
            <p className="inventory-eyebrow">Quản lý kho</p>
            <h1>{currentRoute.label}</h1>
            <p>{currentRoute.description}</p>
          </div>
          <div className="inventory-scope-badge">
            <Icon name="eye" size={16} />
            <span>Phạm vi: <strong>{accessPolicy.scopeLabel}</strong></span>
          </div>
        </header>

        <InventoryConnectionState
          status={connectionStatus}
          error={connectionError}
          isStale={dataIsStale}
          onRetry={retryConnection}
        />

        {currentRoute.page === "dashboard"
          ? <InventoryDashboard />
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
                ? <InventoryCatalogManager domain={masterDataDomain} rows={masterDataState.rows} units={itemUnitsState.rows} categories={itemCategoriesState.rows} canWrite={canWriteMasterData} onSave={masterDataState.save} onArchive={masterDataState.archive} />
                : <InventoryMasterDataManager domain={masterDataDomain} rows={masterDataState.rows} canWrite={canWriteMasterData} onSave={masterDataState.save} onArchive={masterDataState.archive} />
              : documentDomain
                ? <InventoryDocumentManager
                    domain={documentDomain}
                    rows={documentState.rows}
                    warehouses={warehouseState.warehouses}
                    items={documentItemsState.rows}
                    suppliers={documentSuppliersState.rows}
                    canWrite={canWriteDocuments}
                    canApproveDisposals={Boolean(documentState.permissions?.canApproveDisposals)}
                    mutationStatus={documentState.mutationStatus}
                    mutationMessage={documentState.mutationMessage}
                    onSave={documentState.saveDraft}
                    onDeleteDraft={documentState.deleteDraft}
                    onSubmit={documentState.submit}
                    onComplete={documentState.complete}
                    onDispatchTransfer={documentState.dispatchTransfer}
                    onReceiveTransfer={documentState.receiveTransfer}
                    onCompleteTransfer={documentState.completeTransfer}
                    onApproveRequisition={documentState.approveRequisition}
                    onRejectRequisition={documentState.rejectRequisition}
                    onCreateRequisitionTransfer={documentState.createRequisitionTransfer}
                    onFulfillRequisition={documentState.fulfillRequisition}
                    requestCreationMode={accessPolicy.scope === "global" ? "admin_on_behalf" : "warehouse_self"}
                  />
              : <InventoryPageEmptyState route={currentRoute} />}
      </section>
    </InventoryAccessGate>
  );
}

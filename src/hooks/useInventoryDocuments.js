import { useCallback, useEffect, useState } from "react";
import {
  approveInventoryStockAdjustment,
  approveInventoryRequisition,
  canWriteInventoryDocuments,
  completeInventoryTransfer,
  completeSimpleInventoryDocument,
  createInventoryRequisitionTransfer,
  deleteInventoryDocumentDraft,
  dispatchInventoryTransfer,
  fulfillInventoryRequisition,
  INVENTORY_NAVIGATION_COUNTS_CHANGED_EVENT,
  readInventoryDocuments,
  receiveInventoryTransfer,
  rejectInventoryRequisition,
  reverseInventoryPurchaseReceipt,
  saveInventoryDocumentDraft,
  submitInventoryDocument
} from "../services/inventoryDocumentService.js";
import { createDefaultInventoryDocumentFilters } from "../services/inventoryDocumentFilters.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: 50,
  pageCount: 1,
  permissions: {},
  loadedAt: ""
};

export default function useInventoryDocuments({ enabled = false, domain = "", warehouseId = "" } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [mutation, setMutation] = useState({ status: "idle", message: "" });
  const [filters, setFilters] = useState(() => ({ ...createDefaultInventoryDocumentFilters(), warehouseId }));

  useEffect(() => {
    setFilters((current) => current.warehouseId === warehouseId ? current : { ...current, warehouseId, page: 1 });
  }, [warehouseId]);

  const updateFilters = useCallback((patch = {}) => {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: Object.prototype.hasOwnProperty.call(patch, "page") ? patch.page : 1
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !domain) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryDocuments({ domain, ...filters });
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      totalCount: result.totalCount || 0,
      page: result.page || filters.page,
      pageSize: result.pageSize || filters.pageSize,
      pageCount: result.pageCount || 1,
      permissions: result.permissions || {},
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [domain, enabled, filters]);

  useEffect(() => {
    let active = true;
    if (!enabled || !domain) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryDocuments({ domain, ...filters }).then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        rows: result.rows || [],
        totalCount: result.totalCount || 0,
        page: result.page || filters.page,
        pageSize: result.pageSize || filters.pageSize,
        pageCount: result.pageCount || 1,
        permissions: result.permissions || {},
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [domain, enabled, filters]);

  const runMutation = useCallback(async (action, successMessage) => {
    setMutation({ status: "saving", message: "" });
    try {
      const result = await action();
      const resolvedMessage = typeof successMessage === "function" ? successMessage(result) : successMessage;
      setMutation({ status: "success", message: resolvedMessage });
      await refresh();
      if (["requisitions", "transfers", "disposals", "adjustments"].includes(domain) && typeof window !== "undefined") {
        window.dispatchEvent(new window.Event(INVENTORY_NAVIGATION_COUNTS_CHANGED_EVENT));
      }
      return result;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể cập nhật phiếu." });
      throw error;
    }
  }, [domain, refresh]);

  return {
    ...state,
    filters,
    updateFilters,
    refresh,
    writeEnabled: canWriteInventoryDocuments(),
    mutationStatus: mutation.status,
    mutationMessage: mutation.message,
    saveDraft: (input) => runMutation(
      () => saveInventoryDocumentDraft({ domain, input }),
      "Đã lưu phiếu nháp. Phiếu chưa làm thay đổi tồn kho."
    ),
    deleteDraft: (id) => runMutation(
      () => deleteInventoryDocumentDraft(id),
      "Đã xóa bản nháp. Tồn kho không thay đổi."
    ),
    submit: (id) => runMutation(() => submitInventoryDocument(id), "Đã gửi phiếu để xử lý."),
    complete: (id) => runMutation(() => completeSimpleInventoryDocument(id), "Đã hoàn tất phiếu và cập nhật tồn kho."),
    reverseReceipt: (id, reason) => runMutation(
      () => reverseInventoryPurchaseReceipt(id, reason),
      "Đã hoàn tác phiếu nhập, trừ lại tồn kho và lưu đầy đủ lịch sử."
    ),
    approveAdjustment: (id) => runMutation(
      () => approveInventoryStockAdjustment(id),
      "Đã duyệt phiếu điều chỉnh và cập nhật tồn kho."
    ),
    dispatchTransfer: (id, lines) => runMutation(
      () => dispatchInventoryTransfer(id, lines),
      "Đã xác nhận giao hàng và trừ tồn tại kho xuất."
    ),
    receiveTransfer: (id, lines) => runMutation(
      () => receiveInventoryTransfer(id, lines),
      (result) => result?.requires_review
        ? "Đã ghi nhận hàng lệch. Phiếu đang chờ đối chiếu."
        : "Đã nhận đủ hàng và tự động khép luồng."
    ),
    completeTransfer: (id) => runMutation(
      () => completeInventoryTransfer(id),
      "Đã hoàn tất phiếu chuyển kho."
    ),
    approveRequisition: (id, sourceWarehouseId, lines) => runMutation(
      () => approveInventoryRequisition(id, sourceWarehouseId, lines),
      "Đã duyệt và tạo sẵn phiếu giao hàng."
    ),
    rejectRequisition: (id, sourceWarehouseId, reason) => runMutation(
      () => rejectInventoryRequisition(id, sourceWarehouseId, reason),
      "Đã từ chối yêu cầu xuất kho."
    ),
    createRequisitionTransfer: (id) => runMutation(
      () => createInventoryRequisitionTransfer(id),
      "Đã tạo phiếu chuyển kho từ yêu cầu."
    ),
    fulfillRequisition: (id) => runMutation(
      () => fulfillInventoryRequisition(id),
      "Đã khép yêu cầu xuất kho."
    )
  };
}

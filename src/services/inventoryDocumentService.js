import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

const DOCUMENT_TYPES = {
  receipts: "purchase_receipt",
  issues: "stock_issue",
  transfers: "transfer",
  disposals: "waste",
  requisitions: "internal_requisition"
};

const DOCUMENT_PREFIXES = {
  purchase_receipt: "PNK",
  stock_issue: "PXK",
  transfer: "CK",
  waste: "PH",
  internal_requisition: "YCX"
};

export const INVENTORY_NAVIGATION_COUNTS_CHANGED_EVENT = "ghr:inventory-navigation-counts-changed";

const TRANSFER_ACTION_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "in_transit",
  "received",
  "received_with_variance"
];

const DOCUMENT_SELECT = [
  "id", "document_no", "document_type", "status", "source_warehouse_id",
  "destination_warehouse_id", "supplier_id", "source_document_id", "reference_no", "occurred_at",
  "notes", "total_amount", "metadata", "rejection_reason", "created_at", "completed_at"
].join(",");

const LINE_SELECT = [
  "id", "document_id", "item_id", "unit_id", "conversion_to_base",
  "expected_quantity", "approved_quantity", "shipped_quantity",
  "received_quantity", "actual_quantity", "base_quantity", "unit_price",
  "variance_reason", "rejection_reason", "notes"
].join(",");

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function createKey(prefix = "inventory") {
  const uuid = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function createDocumentNo(documentType) {
  const prefix = DOCUMENT_PREFIXES[documentType] || "KHO";
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${date}-${time}-${suffix}`;
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

async function getActorId(client) {
  const { data } = await client.auth.getSession();
  return toText(data?.session?.user?.id);
}

function normalizeLine(row = {}) {
  return {
    id: toText(row.id),
    documentId: toText(row.document_id),
    itemId: toText(row.item_id),
    unitId: toText(row.unit_id),
    conversionToBase: Number(row.conversion_to_base || 1),
    expectedQuantity: Number(row.expected_quantity || 0),
    approvedQuantity: row.approved_quantity == null ? null : Number(row.approved_quantity),
    shippedQuantity: row.shipped_quantity == null ? null : Number(row.shipped_quantity),
    receivedQuantity: row.received_quantity == null ? null : Number(row.received_quantity),
    actualQuantity: row.actual_quantity == null ? null : Number(row.actual_quantity),
    baseQuantity: Number(row.base_quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    varianceReason: toText(row.variance_reason),
    rejectionReason: toText(row.rejection_reason),
    disposalReason: toText(row.notes),
    notes: toText(row.notes)
  };
}

function normalizeDocument(row = {}, lines = []) {
  return {
    id: toText(row.id),
    documentNo: toText(row.document_no),
    documentType: toText(row.document_type),
    status: toText(row.status || "draft"),
    sourceWarehouseId: toText(row.source_warehouse_id),
    destinationWarehouseId: toText(row.destination_warehouse_id),
    supplierId: toText(row.supplier_id),
    sourceDocumentId: toText(row.source_document_id),
    referenceNo: toText(row.reference_no),
    occurredAt: toText(row.occurred_at),
    notes: toText(row.notes),
    totalAmount: Number(row.total_amount || 0),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    rejectionReason: toText(row.rejection_reason),
    createdAt: toText(row.created_at),
    completedAt: toText(row.completed_at),
    linkedTransfer: row.linkedTransfer || null,
    lines
  };
}

function normalizeReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42P01", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_documents_missing", message: "Schema chứng từ Kho chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_documents_denied", message: "Tài khoản chưa có quyền xem chứng từ Kho." };
  }
  return { status: "error", code: "inventory_documents_failed", message: toText(error.message) || "Không tải được chứng từ Kho." };
}

export function getInventoryDocumentType(domain = "") {
  return DOCUMENT_TYPES[domain] || "";
}

export function canWriteInventoryDocuments() {
  return isInventoryRuntimeWriteEnabled();
}

export function canApproveInventoryDisposals(roles = []) {
  return roles.some((role) => ["owner", "admin", "central_manager"].includes(toText(role)));
}

export async function readInventoryDocuments({ domain = "receipts", limit = 200 } = {}) {
  const documentType = getInventoryDocumentType(domain);
  if (!documentType) return { ok: false, status: "error", rows: [], message: "Loại chứng từ không hợp lệ." };
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const { data, error } = await client
    .from("inventory_documents")
    .select(DOCUMENT_SELECT)
    .eq("document_type", documentType)
    .order("occurred_at", { ascending: false })
    .limit(Math.max(20, Math.min(500, Number(limit || 200))));
  recordAdminRequest(`read inventory ${domain}`, "inventory_documents");
  if (error) return { ok: false, ...normalizeReadError(error), rows: [] };

  const documents = Array.isArray(data) ? data : [];
  const documentIds = documents.map((row) => row.id).filter(Boolean);
  let lineRows = [];
  if (documentIds.length) {
    const lineResult = await client
      .from("inventory_document_lines")
      .select(LINE_SELECT)
      .in("document_id", documentIds);
    if (lineResult.error) return { ok: false, ...normalizeReadError(lineResult.error), rows: [] };
    lineRows = Array.isArray(lineResult.data) ? lineResult.data : [];
  }
  const linesByDocument = new Map();
  lineRows.forEach((row) => {
    const current = linesByDocument.get(row.document_id) || [];
    current.push(normalizeLine(row));
    linesByDocument.set(row.document_id, current);
  });

  let linkedTransfers = [];
  if (domain === "requisitions" && documentIds.length) {
    const transferResult = await client
      .from("inventory_documents")
      .select(DOCUMENT_SELECT)
      .eq("document_type", "transfer")
      .in("source_document_id", documentIds);
    if (transferResult.error) return { ok: false, ...normalizeReadError(transferResult.error), rows: [] };
    linkedTransfers = Array.isArray(transferResult.data) ? transferResult.data : [];
  }
  const linkedTransferLinesByDocument = new Map();
  const linkedTransferIds = linkedTransfers.map((row) => row.id).filter(Boolean);
  if (linkedTransferIds.length) {
    const linkedLineResult = await client
      .from("inventory_document_lines")
      .select(LINE_SELECT)
      .in("document_id", linkedTransferIds);
    if (linkedLineResult.error) return { ok: false, ...normalizeReadError(linkedLineResult.error), rows: [] };
    (Array.isArray(linkedLineResult.data) ? linkedLineResult.data : []).forEach((row) => {
      const current = linkedTransferLinesByDocument.get(row.document_id) || [];
      current.push(normalizeLine(row));
      linkedTransferLinesByDocument.set(row.document_id, current);
    });
  }
  const transferByRequisition = new Map(linkedTransfers.map((row) => [
    row.source_document_id,
    normalizeDocument(row, linkedTransferLinesByDocument.get(row.id) || [])
  ]));

  let permissions = {};
  if (domain === "disposals") {
    const actorId = await getActorId(client);
    let approvalRoles = [];
    if (actorId) {
      const accessResult = await client
        .from("inventory_user_access")
        .select("role")
        .eq("auth_user_id", actorId)
        .eq("is_active", true);
      if (!accessResult.error) approvalRoles = (accessResult.data || []).map((row) => toText(row.role));
    }
    permissions = {
      canApproveDisposals: canApproveInventoryDisposals(approvalRoles)
    };
  }

  return {
    ok: true,
    status: "ready",
    rows: documents.map((row) => normalizeDocument(
      { ...row, linkedTransfer: transferByRequisition.get(row.id) || null },
      linesByDocument.get(row.id) || []
    )),
    permissions,
    message: ""
  };
}

export async function readInventoryPendingRequisitionCount() {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { count, error } = await client
    .from("inventory_documents")
    .select("id", { count: "exact", head: true })
    .eq("document_type", "internal_requisition")
    .eq("status", "submitted");
  recordAdminRequest("count pending inventory requisitions", "inventory_documents");
  if (error) throw new Error(normalizeReadError(error).message);
  return Math.max(0, Number(count || 0));
}

export async function readInventoryPendingTransferCount() {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { count, error } = await client
    .from("inventory_documents")
    .select("id", { count: "exact", head: true })
    .eq("document_type", "transfer")
    .in("status", TRANSFER_ACTION_STATUSES);
  recordAdminRequest("count actionable inventory transfers", "inventory_documents");
  if (error) throw new Error(normalizeReadError(error).message);
  return Math.max(0, Number(count || 0));
}

export async function readInventoryPendingDisposalCount() {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { count, error } = await client
    .from("inventory_documents")
    .select("id", { count: "exact", head: true })
    .eq("document_type", "waste")
    .eq("status", "submitted");
  recordAdminRequest("count pending inventory disposals", "inventory_documents");
  if (error) throw new Error(normalizeReadError(error).message);
  return Math.max(0, Number(count || 0));
}

function validateDraftInput(domain, input = {}) {
  const documentType = getInventoryDocumentType(domain);
  if (!documentType) throw new Error("Loại chứng từ không hợp lệ.");
  const lines = (Array.isArray(input.lines) ? input.lines : []).map((line) => ({
    itemId: toText(line.itemId),
    unitId: toText(line.unitId),
    conversionToBase: Number(line.conversionToBase || 1),
    quantity: Number(line.quantity || 0),
    unitPrice: Math.max(0, Number(line.unitPrice || 0)),
    disposalReason: toText(line.disposalReason),
    notes: toText(line.notes)
  }));
  if (!lines.length || lines.some((line) => !line.itemId || !line.unitId || line.quantity <= 0 || line.conversionToBase <= 0)) {
    throw new Error("Phiếu cần ít nhất một nguyên vật liệu có số lượng lớn hơn 0.");
  }
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
    throw new Error("Một nguyên vật liệu chỉ được xuất hiện một lần trong phiếu.");
  }
  const sourceWarehouseId = toText(input.sourceWarehouseId);
  const destinationWarehouseId = toText(input.destinationWarehouseId);
  if (["issues", "transfers", "disposals"].includes(domain) && !sourceWarehouseId) throw new Error("Vui lòng chọn kho xuất.");
  if (["receipts", "transfers", "requisitions"].includes(domain) && !destinationWarehouseId) throw new Error("Vui lòng chọn kho nhận.");
  if (domain === "transfers" && sourceWarehouseId === destinationWarehouseId) throw new Error("Kho xuất và kho nhận phải khác nhau.");
  if (domain === "issues" && !toText(input.issueReason)) throw new Error("Vui lòng nhập lý do xuất kho.");
  if (domain === "disposals" && !toText(input.disposalReason)) throw new Error("Vui lòng chọn lý do hủy.");
  return { documentType, lines, sourceWarehouseId, destinationWarehouseId };
}

export async function saveInventoryDocumentDraft({ domain = "receipts", input = {} } = {}) {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const normalized = validateDraftInput(domain, input);
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");
  const totalAmount = normalized.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const noteText = toText(input.notes);
  const disposalReason = toText(input.disposalReason);
  const headerPayload = {
    document_no: createDocumentNo(normalized.documentType),
    idempotency_key: createKey("draft"),
    document_type: normalized.documentType,
    status: "draft",
    source_warehouse_id: normalized.sourceWarehouseId || null,
    destination_warehouse_id: normalized.destinationWarehouseId || null,
    supplier_id: toText(input.supplierId) || null,
    reference_no: toText(input.referenceNo) || null,
    occurred_at: input.occurredAt || new Date().toISOString(),
    notes: normalized.documentType === "waste"
      ? `${disposalReason}${noteText ? ` — ${noteText}` : ""}`
      : noteText || null,
    total_amount: totalAmount,
    metadata: normalized.documentType === "stock_issue"
      ? { issue_reason: toText(input.issueReason) }
      : normalized.documentType === "waste"
        ? { disposal_reason: disposalReason }
      : normalized.documentType === "internal_requisition"
        ? {
            request_origin: toText(input.requestOrigin) === "admin_on_behalf" ? "admin_on_behalf" : "warehouse_self",
            requested_for_warehouse_id: normalized.destinationWarehouseId
          }
        : {},
    created_by: actorId
  };
  const headerResult = await client
    .from("inventory_documents")
    .insert(headerPayload)
    .select(DOCUMENT_SELECT)
    .single();
  recordAdminRequest(`create inventory ${domain} draft`, "inventory_documents");
  if (headerResult.error) throw new Error(normalizeReadError(headerResult.error).message);

  const linePayload = normalized.lines.map((line) => ({
    document_id: headerResult.data.id,
    item_id: line.itemId,
    unit_id: line.unitId,
    conversion_to_base: line.conversionToBase,
    expected_quantity: line.quantity,
    actual_quantity: ["receipts", "issues", "disposals"].includes(domain) ? line.quantity : null,
    unit_price: domain === "receipts" ? line.unitPrice : 0,
    notes: domain === "disposals"
      ? line.disposalReason || disposalReason
      : line.notes || null
  }));
  const lineResult = await client.from("inventory_document_lines").insert(linePayload).select(LINE_SELECT);
  recordAdminRequest(`create inventory ${domain} lines`, "inventory_document_lines");
  if (lineResult.error) throw new Error(normalizeReadError(lineResult.error).message);
  return normalizeDocument(headerResult.data, (lineResult.data || []).map(normalizeLine));
}

export async function deleteInventoryDocumentDraft(documentId = "") {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const normalizedId = toText(documentId);
  if (!normalizedId) throw new Error("Không xác định được phiếu cần xóa.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const { data, error } = await client
    .from("inventory_documents")
    .delete()
    .eq("id", normalizedId)
    .eq("status", "draft")
    .select("id,document_no")
    .maybeSingle();
  recordAdminRequest("delete inventory document draft", "inventory_documents");
  if (error) {
    const message = toText(error.message).toLowerCase();
    if (toText(error.code) === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
      throw new Error("Tài khoản chưa có quyền xóa bản nháp này.");
    }
    throw new Error(toText(error.message) || "Không xóa được bản nháp.");
  }
  if (!data) throw new Error("Chỉ có thể xóa phiếu đang ở trạng thái Bản nháp.");
  return { id: toText(data.id), documentNo: toText(data.document_no) };
}

export async function submitInventoryDocument(documentId = "") {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { data, error } = await client.rpc("inventory_submit_document", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-submit-${toText(documentId)}`
  });
  recordAdminRequest("submit inventory document", "inventory_submit_document");
  if (error) throw new Error(toText(error.message) || "Không gửi được phiếu.");
  return data;
}

export async function completeSimpleInventoryDocument(documentId = "") {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { data, error } = await client.rpc("inventory_complete_simple_document", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-complete-${toText(documentId)}`
  });
  recordAdminRequest("complete inventory document", "inventory_complete_simple_document");
  if (error) throw new Error(toText(error.message) || "Không hoàn tất được phiếu.");
  return data;
}

async function callInventoryRpc(functionName, payload, auditLabel, fallbackMessage) {
  if (!canWriteInventoryDocuments()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { data, error } = await client.rpc(functionName, payload);
  recordAdminRequest(auditLabel, functionName);
  if (error) throw new Error(toText(error.message) || fallbackMessage);
  return data;
}

function requireActionLines(lines = [], quantityKey, { allowZero = false, reasonKey = "" } = {}) {
  const normalized = (Array.isArray(lines) ? lines : []).map((line) => {
    const quantity = Number(line[quantityKey]);
    return {
      lineId: toText(line.lineId),
      quantity,
      reason: reasonKey ? toText(line[reasonKey]) : ""
    };
  });
  if (!normalized.length || normalized.some((line) => !line.lineId || !Number.isFinite(line.quantity) || (allowZero ? line.quantity < 0 : line.quantity <= 0))) {
    throw new Error("Số lượng xử lý chưa hợp lệ.");
  }
  return normalized;
}

export async function dispatchInventoryTransfer(documentId = "", lines = []) {
  const normalized = requireActionLines(lines, "shippedQuantity");
  return callInventoryRpc("inventory_dispatch_transfer", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-dispatch-${toText(documentId)}`,
    p_lines: normalized.map((line) => ({ line_id: line.lineId, shipped_quantity: line.quantity }))
  }, "dispatch inventory transfer", "Không thể xác nhận giao hàng.");
}

export async function receiveInventoryTransfer(documentId = "", lines = []) {
  const normalized = requireActionLines(lines, "receivedQuantity", { allowZero: true, reasonKey: "varianceReason" });
  return callInventoryRpc("inventory_receive_and_finalize_transfer", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-receive-${toText(documentId)}`,
    p_lines: normalized.map((line) => ({ line_id: line.lineId, received_quantity: line.quantity, variance_reason: line.reason || null }))
  }, "receive and finalize inventory transfer", "Không thể xác nhận nhận hàng.");
}

export async function completeInventoryTransfer(documentId = "") {
  return callInventoryRpc("inventory_complete_transfer", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-transfer-complete-${toText(documentId)}`
  }, "complete inventory transfer", "Không thể hoàn tất phiếu chuyển kho.");
}

export async function approveInventoryRequisition(documentId = "", sourceWarehouseId = "", lines = []) {
  if (!toText(sourceWarehouseId)) throw new Error("Vui lòng chọn kho xuất hàng.");
  const normalized = requireActionLines(lines, "approvedQuantity", { allowZero: true, reasonKey: "rejectionReason" });
  return callInventoryRpc("inventory_approve_requisition_and_prepare_transfer", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-requisition-approve-${toText(documentId)}`,
    p_source_warehouse_id: toText(sourceWarehouseId),
    p_lines: normalized.map((line) => ({ line_id: line.lineId, approved_quantity: line.quantity, rejection_reason: line.reason || null }))
  }, "approve requisition and prepare transfer", "Không thể duyệt yêu cầu xuất kho.");
}

export async function rejectInventoryRequisition(documentId = "", sourceWarehouseId = "", rejectionReason = "") {
  if (!toText(sourceWarehouseId) || !toText(rejectionReason)) throw new Error("Kho xuất và lý do từ chối là bắt buộc.");
  return callInventoryRpc("inventory_reject_requisition", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-requisition-reject-${toText(documentId)}`,
    p_source_warehouse_id: toText(sourceWarehouseId),
    p_rejection_reason: toText(rejectionReason)
  }, "reject inventory requisition", "Không thể từ chối yêu cầu xuất kho.");
}

export async function createInventoryRequisitionTransfer(documentId = "") {
  return callInventoryRpc("inventory_create_requisition_transfer", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-requisition-transfer-${toText(documentId)}`
  }, "create transfer from requisition", "Không thể tạo phiếu chuyển từ yêu cầu.");
}

export async function fulfillInventoryRequisition(documentId = "") {
  return callInventoryRpc("inventory_fulfill_requisition", {
    p_document_id: toText(documentId),
    p_idempotency_key: `inventory-requisition-fulfill-${toText(documentId)}`
  }, "fulfill inventory requisition", "Chưa thể khép yêu cầu xuất kho.");
}

export default {
  readInventoryDocuments,
  saveInventoryDocumentDraft,
  submitInventoryDocument,
  completeSimpleInventoryDocument,
  dispatchInventoryTransfer,
  receiveInventoryTransfer,
  completeInventoryTransfer,
  approveInventoryRequisition,
  rejectInventoryRequisition,
  createInventoryRequisitionTransfer,
  fulfillInventoryRequisition,
  canWriteInventoryDocuments
};

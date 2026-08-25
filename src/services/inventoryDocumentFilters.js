const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatInventoryDateInput(value = new Date()) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getInventoryDocumentDateRange(preset = "30d", referenceDate = new Date()) {
  const end = toDate(referenceDate);
  const start = new Date(end);
  const days = preset === "today" ? 1 : preset === "7d" ? 7 : 30;
  start.setDate(start.getDate() - (days - 1));
  return {
    fromDate: formatInventoryDateInput(start),
    toDate: formatInventoryDateInput(end)
  };
}

export function createDefaultInventoryDocumentFilters(referenceDate = new Date()) {
  return {
    datePreset: "30d",
    ...getInventoryDocumentDateRange("30d", referenceDate),
    status: "all",
    page: 1,
    pageSize: 50
  };
}

export function getInventoryDocumentDateTimeBounds(fromDate = "", toDate = "") {
  const normalizedFromDate = DATE_PATTERN.test(String(fromDate || "")) ? String(fromDate) : "";
  const normalizedToDate = DATE_PATTERN.test(String(toDate || "")) ? String(toDate) : "";
  return {
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
    fromDateTime: normalizedFromDate ? `${normalizedFromDate}T00:00:00+07:00` : "",
    toDateTime: normalizedToDate ? `${normalizedToDate}T23:59:59.999+07:00` : ""
  };
}

export function getInventoryDocumentPagination(page = 1, pageSize = 50) {
  const safePage = Math.max(1, Math.trunc(Number(page || 1)));
  const safePageSize = Math.max(20, Math.min(100, Math.trunc(Number(pageSize || 50))));
  return {
    page: safePage,
    pageSize: safePageSize,
    from: (safePage - 1) * safePageSize,
    to: safePage * safePageSize - 1
  };
}

export default {
  formatInventoryDateInput,
  getInventoryDocumentDateRange,
  createDefaultInventoryDocumentFilters,
  getInventoryDocumentDateTimeBounds,
  getInventoryDocumentPagination
};

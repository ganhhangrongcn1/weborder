const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_OFFSET = "+07:00";

function getDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function toVietnamDateInputValue(date = new Date()) {
  const parts = getDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDaysToVietnamDateInput(dateText = "", days = 0) {
  const normalized = String(dateText || "").trim();
  if (!normalized) return "";
  const date = new Date(`${normalized}T00:00:00${VIETNAM_OFFSET}`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return toVietnamDateInputValue(date);
}

export function buildVietnamDateRange(dateFromValue = "", dateToValue = "") {
  let fromText = String(dateFromValue || "").trim();
  let toText = String(dateToValue || "").trim();
  if (!fromText && !toText) return {};

  if (fromText && toText && fromText > toText) {
    const temp = fromText;
    fromText = toText;
    toText = temp;
  }

  const range = {};
  if (fromText) {
    const fromDate = new Date(`${fromText}T00:00:00${VIETNAM_OFFSET}`);
    if (!Number.isNaN(fromDate.getTime())) range.dateFrom = fromDate.toISOString();
  }
  if (toText) {
    const nextDateText = addDaysToVietnamDateInput(toText, 1);
    const toDate = new Date(`${nextDateText}T00:00:00${VIETNAM_OFFSET}`);
    if (!Number.isNaN(toDate.getTime())) range.dateTo = toDate.toISOString();
  }
  return range;
}

export function hasDateRange(dateRange = {}) {
  return Boolean(dateRange?.dateFrom || dateRange?.dateTo);
}

export default {
  toVietnamDateInputValue,
  addDaysToVietnamDateInput,
  buildVietnamDateRange,
  hasDateRange
};

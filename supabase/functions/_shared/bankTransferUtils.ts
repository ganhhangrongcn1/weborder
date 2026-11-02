export type JsonRecord = Record<string, unknown>;

export function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

export function toNumber(value: unknown = 0) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function normalizePhone(value: unknown = "") {
  const digits = toText(value).replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return digits;
}

export function normalizeIsoDate(value: unknown = "") {
  const raw = toText(value);
  if (!raw) return new Date().toISOString();

  const normalized = raw.includes("T")
    ? raw
    : raw.replace(" ", "T");

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

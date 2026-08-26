import { getInventoryItemDisplayUnitConfig } from "./inventoryUnitConversion.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOrdinal(value = "") {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function getInventoryTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getInventoryLotDaysRemaining(expiresOn = "", todayKey = getInventoryTodayKey()) {
  const expiry = toDateOrdinal(expiresOn);
  const today = toDateOrdinal(todayKey);
  return expiry === null || today === null ? null : Math.round((expiry - today) / DAY_MS);
}

export function getInventoryLotExpiryState(row = {}, item = {}, todayKey = getInventoryTodayKey()) {
  const daysRemaining = getInventoryLotDaysRemaining(row.expiresOn, todayKey);
  if (daysRemaining === null) return "untracked";
  if (daysRemaining < 0) return "expired";
  const warningDays = Math.max(0, Math.trunc(Number(item.expiryWarningDays || 0)));
  return daysRemaining <= warningDays ? "expiring" : "valid";
}

export function getInventoryLotDisplayValues(row = {}, item = {}, unitsById = new Map()) {
  const displayUnit = getInventoryItemDisplayUnitConfig(item, unitsById);
  const factor = displayUnit.conversionToBase > 0 ? displayUnit.conversionToBase : 1;
  return {
    remainingQuantity: Number(row.remainingQuantity || 0) / factor,
    receivedQuantity: Number(row.receivedQuantity || 0) / factor,
    unitName: displayUnit.unit.name || item.baseUnit?.name || "Đơn vị",
    unitSymbol: displayUnit.unit.symbol || displayUnit.unit.name || item.baseUnit?.symbol || "đv"
  };
}

export function calculateInventoryLotSummary(rows = [], itemById = new Map(), todayKey = getInventoryTodayKey()) {
  return rows.reduce((summary, row) => {
    const state = getInventoryLotExpiryState(row, itemById.get(row.itemId) || {}, todayKey);
    summary.total += 1;
    summary[state] += 1;
    return summary;
  }, { total: 0, expired: 0, expiring: 0, valid: 0, untracked: 0 });
}

export default {
  getInventoryTodayKey,
  getInventoryLotDaysRemaining,
  getInventoryLotExpiryState,
  getInventoryLotDisplayValues,
  calculateInventoryLotSummary
};

import { playLocalNewOrderAlert, playLocalQrPaymentAlert, playLocalWebsiteOrderAlert } from "./posPrinterService";

const announced = new Map();
export function isWebsiteOrderPaid(order = {}) {
  return ["paid", "converted", "completed", "success"].includes(String(order.paymentStatus || order.payment_status || order.metadata?.paymentStatus || "").toLowerCase()) || Boolean(order.paidAt || order.paid_at);
}

// Shared by order sync and print jobs, keyed by canonical order id.
export async function playPosOrderAlert(id, type = "new") {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return false;
  const prior = announced.get(key);
  if (prior === "paid" || prior === type || (prior && type !== "paid")) return false;
  announced.set(key, type);
  if (announced.size > 500) announced.delete(announced.keys().next().value);
  try {
    if (type === "paid") return await playLocalQrPaymentAlert();
    return type === "website" ? await playLocalWebsiteOrderAlert() : await playLocalNewOrderAlert();
  } catch (error) {
    if (announced.get(key) === type) announced.delete(key);
    throw error;
  }
}

export function getWebsiteOrderAlertChanges(orders = [], previous = null) {
  const next = new Map(orders.filter((order) => order.id).map((order) => [String(order.id), isWebsiteOrderPaid(order)]));
  const events = previous === null ? [] : orders.filter((order) => order.id && (!previous.has(String(order.id)) || (!previous.get(String(order.id)) && isWebsiteOrderPaid(order))));
  return { next, events };
}

export default playPosOrderAlert;

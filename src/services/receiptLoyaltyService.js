import repository from "./repositories/receiptLoyaltyRepository.js";
import { getCustomerKey } from "./storageService.js";

export function normalizeReceiptPhone(value = "") {
  const phone = getCustomerKey(value);
  if (!/^0[35789]\d{8}$/.test(phone)) throw new Error("Vui lòng nhập số điện thoại Việt Nam hợp lệ.");
  return phone;
}

export function readReceiptLoyalty(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) throw new Error("Vui lòng quét mã QR ở cuối bill để mở đúng đơn của bạn.");
  return repository.read(token);
}

export function claimReceiptLoyalty(token, phone) {
  return repository.claim(token, normalizeReceiptPhone(phone));
}

export function readReceiptPointSummary(phone) {
  return repository.summary(normalizeReceiptPhone(phone));
}

export async function prepareReceiptLoyaltyUrl(order = {}) {
  const id = String(order.id || "").trim();
  if (!id) return "";
  const source = [order.sourceType, order.source, order.partnerSource, order.partner_source, order.platform]
    .filter(Boolean).join(" ").toLowerCase();
  const partner = /partner|grab|shopee|xanh|nexpos/.test(source);
  return await repository.link(partner ? "PARTNER_ORDER" : "ORDER", id) || "";
}

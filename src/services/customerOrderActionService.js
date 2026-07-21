import { orderRepository } from "./repositories/orderRepository.js";
import { cancelQrOrderPayment } from "./qrPaymentService.js";

export const CUSTOMER_SUPPORT_ZALO_PHONE = "0933799061";
export const CUSTOMER_SUPPORT_ZALO_URL = `https://zalo.me/${CUSTOMER_SUPPORT_ZALO_PHONE}`;

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createCustomerOrderActionProof() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error("Trình duyệt chưa hỗ trợ bảo mật cần thiết để tạo đơn thanh toán.");
  }

  const randomBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(randomBytes);
  const token = bytesToBase64Url(randomBytes);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return {
    token,
    tokenHash: bytesToHex(new Uint8Array(digest))
  };
}

export function saveCustomerOrderActionToken(orderId, token) {
  return orderRepository.saveCustomerActionToken(orderId, token);
}

export function prepareOrderForPaymentResume(order = {}) {
  const nextOrder = orderRepository.hydrateRecoveredOrder(order) || order;
  orderRepository.saveLastCreatedOrderId(nextOrder.id || nextOrder.orderCode || "");
  orderRepository.saveCurrentOrder(nextOrder);
  return nextOrder;
}

export async function cancelCustomerUnpaidOrder(order = {}) {
  const orderId = String(order?.id || order?.orderCode || "").trim();
  const customerActionToken = orderRepository.getCustomerActionToken(orderId);
  const result = await cancelQrOrderPayment({ order, customerActionToken });
  if (result?.ok) {
    orderRepository.clearCustomerActionToken(orderId);
  }
  return result;
}

export default {
  CUSTOMER_SUPPORT_ZALO_PHONE,
  CUSTOMER_SUPPORT_ZALO_URL,
  createCustomerOrderActionProof,
  saveCustomerOrderActionToken,
  prepareOrderForPaymentResume,
  cancelCustomerUnpaidOrder
};

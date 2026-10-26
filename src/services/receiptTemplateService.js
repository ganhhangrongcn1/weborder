import { receiptTemplateRepository } from "./repositories/receiptTemplateRepository.js";
import { normalizeReceiptTemplate } from "../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js";

let cached = normalizeReceiptTemplate();
let loadedAt = 0;
let pending;
export function getReceiptTemplate() { return cached; }
export async function loadReceiptTemplate({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < 60000) return cached;
  if (pending) return pending;
  pending = receiptTemplateRepository.read().then((value) => {
    cached = normalizeReceiptTemplate(value);
    loadedAt = Date.now();
    return cached;
  }).finally(() => { loadedAt = Date.now(); pending = null; });
  return pending;
}
export async function saveReceiptTemplate(value) {
  const next = normalizeReceiptTemplate(value);
  await receiptTemplateRepository.save(next);
  cached = next;
  loadedAt = Date.now();
  return next;
}

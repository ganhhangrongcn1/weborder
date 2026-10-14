import assert from "node:assert/strict";
import {
  formatInventoryStockShortageMessage,
  parseInventoryStockShortageMessage
} from "../src/services/inventoryDocumentErrorMessages.js";

const rawMessage = "Tồn kho không đủ cho mặt hàng a40bd410-ff64-49a7-addc-d8ff79b64422. Hiện có 0.000000, cần xuất 200.000000.";

assert.deepEqual(parseInventoryStockShortageMessage(rawMessage), {
  itemId: "a40bd410-ff64-49a7-addc-d8ff79b64422",
  availableBaseQuantity: 0,
  requiredBaseQuantity: 200
});

assert.equal(formatInventoryStockShortageMessage(rawMessage, {
  itemName: "rau răm sơ chế",
  unitName: "Kilogram",
  conversionToBase: 1000
}), "Tồn kho không đủ cho rau răm sơ chế. Hiện có 0 Kilogram, cần xuất 0,2 Kilogram.");

assert.equal(formatInventoryStockShortageMessage("Lỗi khác"), "Lỗi khác");

console.log("inventory-document-errors.test.mjs: passed");

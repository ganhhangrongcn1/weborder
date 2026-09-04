import test from "node:test";
import assert from "node:assert/strict";

import {
  createReceiptLotNumber,
  getReceiptLineItemDefaults,
  getReceiptUnitPrice,
  getSuggestedExpiryDate
} from "../src/pages/admin/inventory/inventoryReceiptForm.js";
import { validateInventoryDocumentDraftInput } from "../src/services/inventoryDocumentService.js";

const item = {
  id: "item-1",
  code: "NVL_000002",
  trackExpiry: true,
  shelfLifeDays: 7
};

const validInput = {
  destinationWarehouseId: "warehouse-1",
  supplierId: "supplier-1",
  lines: [{
    itemId: "item-1",
    unitId: "unit-1",
    conversionToBase: 1000,
    quantity: 2,
    unitPrice: 30000,
    lotNumber: "LO-TEST-001",
    manufacturedOn: "2026-08-25",
    expiresOn: "2026-09-01",
    trackExpiry: true
  }]
};

test("tự sinh mã lô gọn theo nguyên vật liệu", () => {
  const lotNumber = createReceiptLotNumber(item, "2026-08-25T08:30:00+07:00");
  assert.match(lotNumber, /^LO-20260825-0830-NVL-000002$/);
});

test("gợi ý hạn sử dụng từ ngày tham chiếu, ưu tiên ngày sản xuất", () => {
  assert.equal(getSuggestedExpiryDate(item, "2026-08-25T08:30:00+07:00"), "2026-09-01");
  assert.equal(getSuggestedExpiryDate(item, "2026-08-20T00:00:00+07:00"), "2026-08-27");
  const defaults = getReceiptLineItemDefaults(item, "2026-08-25T08:30:00+07:00");
  assert.equal(defaults.trackExpiry, true);
  assert.equal(defaults.expiryManuallyEdited, false);
});

test("tự điền giá mua mặc định và quy đổi đúng khi nhập bằng đơn vị gốc", () => {
  const pricedItem = {
    ...item,
    itemType: "ingredient",
    baseUnitId: "unit-gram",
    purchaseUnitId: "unit-kg",
    purchaseToBaseRatio: 1000,
    defaultPurchasePrice: 120000
  };
  assert.equal(getReceiptLineItemDefaults(pricedItem, "2026-08-25T08:30:00+07:00").unitPrice, 120000);
  assert.equal(getReceiptUnitPrice(pricedItem, "unit-gram"), 120);
  assert.equal(getReceiptUnitPrice({ ...pricedItem, itemType: "semi_finished" }, "unit-kg"), 0);
  assert.equal(getReceiptLineItemDefaults({}, "2026-08-25T08:30:00+07:00").unitPrice, 0);
});

test("phiếu nhập bắt buộc nhà cung cấp, mã lô và HSD khi có theo dõi", () => {
  assert.throws(
    () => validateInventoryDocumentDraftInput("receipts", { ...validInput, supplierId: "" }),
    /nhà cung cấp/i
  );
  assert.throws(
    () => validateInventoryDocumentDraftInput("receipts", {
      ...validInput,
      lines: [{ ...validInput.lines[0], lotNumber: "" }]
    }),
    /mã lô/i
  );
  assert.throws(
    () => validateInventoryDocumentDraftInput("receipts", {
      ...validInput,
      lines: [{ ...validInput.lines[0], expiresOn: "" }]
    }),
    /hạn sử dụng/i
  );
});

test("phiếu nhập hợp lệ giữ nguyên dữ liệu lô", () => {
  const result = validateInventoryDocumentDraftInput("receipts", validInput);
  assert.equal(result.documentType, "purchase_receipt");
  assert.equal(result.lines[0].lotNumber, "LO-TEST-001");
  assert.equal(result.lines[0].expiresOn, "2026-09-01");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryMasterDataCode,
  normalizeInventoryMasterDataInput,
  normalizeInventoryItem,
  normalizeInventoryItemCategory,
  normalizeInventorySupplier,
  normalizeInventoryUnit
} from "../src/services/inventoryMasterDataService.js";

test("chuẩn hoá mã và đơn vị tính trước khi ghi", () => {
  assert.deepEqual(normalizeInventoryMasterDataInput("units", {
    code: " kg lon ",
    name: " Kilôgam lớn ",
    symbol: " kg ",
    unitType: "weight",
    displayOrder: 4
  }), {
    code: "KG_LON",
    name: "Kilôgam lớn",
    symbol: "kg",
    unit_type: "weight",
    decimal_places: 3,
    base_unit_id: null,
    conversion_factor: 1,
    display_order: 4,
    is_active: true
  });
});

test("tự đặt số lẻ theo loại đo lường", () => {
  const countUnit = normalizeInventoryMasterDataInput("units", {
    code: "CAI",
    name: "Cái",
    unitType: "count"
  });
  const volumeUnit = normalizeInventoryMasterDataInput("units", {
    code: "ML",
    name: "Mililít",
    unitType: "volume"
  });

  assert.equal(countUnit.decimal_places, 0);
  assert.equal(volumeUnit.decimal_places, 3);
});

test("đơn vị tự sinh mã và nhận diện loại đo lường", () => {
  const weightUnit = normalizeInventoryMasterDataInput("units", {
    name: "Kilôgam",
    symbol: "kg"
  });
  const countUnit = normalizeInventoryMasterDataInput("units", {
    name: "Cái"
  });

  assert.equal(weightUnit.code, "KILOGAM");
  assert.equal(weightUnit.unit_type, "weight");
  assert.equal(countUnit.code, "CAI");
  assert.equal(countUnit.unit_type, "count");
});

test("mọi đơn vị tính đều được lưu thành đơn vị gốc", () => {
  const payload = normalizeInventoryMasterDataInput("units", {
    code: "KG",
    name: "Kilôgam",
    unitType: "weight",
    baseUnitId: "unit-gram",
    conversionFactor: 1000
  });

  assert.equal(payload.base_unit_id, null);
  assert.equal(payload.conversion_factor, 1);
});

test("chuẩn hoá mô tả và thứ tự danh mục", () => {
  assert.deepEqual(normalizeInventoryMasterDataInput("item-categories", {
    code: " GIA VI ",
    name: " Gia vị ",
    description: " Gia vị khô và sốt nêm ",
    displayOrder: 2
  }), {
    code: "GIA_VI",
    name: "Gia vị",
    description: "Gia vị khô và sốt nêm",
    display_order: 2,
    is_active: true
  });
});

test("danh mục tự sinh mã từ tên và thêm hậu tố khi trùng", () => {
  assert.equal(normalizeInventoryMasterDataInput("item-categories", {
    name: "Gia vị và sốt nêm"
  }).code, "GIA_VI_VA_SOT_NEM");
  assert.equal(createInventoryMasterDataCode("Gia vị và sốt nêm", [
    "GIA_VI_VA_SOT_NEM",
    "GIA_VI_VA_SOT_NEM_2"
  ]), "GIA_VI_VA_SOT_NEM_3");
});

test("nhà cung cấp tự sinh mã có tiền tố và tránh trùng", () => {
  assert.equal(createInventoryMasterDataCode("NCC Công ty Thực phẩm An Nhiên", []), "NCC_CONG_TY_THUC_PHAM_AN_NHIEN");
  assert.equal(createInventoryMasterDataCode("NCC Công ty Thực phẩm An Nhiên", [
    "NCC_CONG_TY_THUC_PHAM_AN_NHIEN",
    "NCC_CONG_TY_THUC_PHAM_AN_NHIEN_2"
  ]), "NCC_CONG_TY_THUC_PHAM_AN_NHIEN_3");
});

test("không nhận tỷ lệ quy đổi bằng không", () => {
  assert.throws(() => normalizeInventoryMasterDataInput("items", {
    code: "BOT",
    name: "Bột",
    baseUnitId: "unit-1",
    purchaseToBaseRatio: 0
  }), /lớn hơn 0/i);
});

test("nguyên vật liệu dùng đơn vị tồn làm đơn vị mua mặc định", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    name: "Bột mì",
    baseUnitId: "unit-kg",
    itemType: "consumable",
    reorderPoint: 5
  });
  assert.equal(Object.hasOwn(payload, "code"), false);
  assert.equal(payload.item_type, "consumable");
  assert.equal(payload.purchase_unit_id, "unit-kg");
  assert.equal(payload.reorder_point, 5);
  assert.equal(payload.metadata.display_unit_id, "unit-kg");
  assert.equal(payload.metadata.order_quantity, 0);
  assert.equal(payload.metadata.maximum_stock, 0);
  assert.equal(payload.metadata.default_waste_percent, 0);
  assert.equal(payload.metadata.track_expiry, false);
});

test("nguyên vật liệu lưu tỷ lệ quy đổi riêng từ chai sang đơn vị tồn", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    name: "Sốt me",
    displayUnitId: "unit-ml",
    baseUnitId: "unit-ml",
    purchaseUnitId: "unit-chai",
    purchaseToBaseRatio: 500
  });

  assert.equal(payload.base_unit_id, "unit-ml");
  assert.equal(payload.purchase_unit_id, "unit-chai");
  assert.equal(payload.purchase_to_base_ratio, 500);
  assert.equal(payload.metadata.display_unit_id, "unit-ml");
});

test("đơn vị hiển thị luôn là đơn vị gốc dù dữ liệu cũ còn giữ đơn vị khác", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    name: "Dầu Ớt",
    displayUnitId: "unit-bich",
    baseUnitId: "unit-gram",
    purchaseUnitId: "unit-kg",
    purchaseToBaseRatio: 200
  });

  assert.equal(payload.base_unit_id, "unit-bich");
  assert.equal(payload.purchase_unit_id, "unit-kg");
  assert.equal(payload.purchase_to_base_ratio, 200);
  assert.equal(payload.metadata.display_unit_id, "unit-bich");
});

test("bán thẳng dùng thành phẩm và lưu cấu hình tồn kho mở rộng", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    name: "Nước suối chai",
    itemType: "direct_sale",
    displayUnitId: "unit-kg",
    baseUnitId: "unit-chai",
    reorderPoint: 12,
    orderQuantity: 24,
    minimumStock: 6,
    maximumStock: 120,
    defaultWastePercent: 2.5,
    trackExpiry: true,
    shelfLifeDays: 30,
    expiryWarningDays: 3
  });
  assert.equal(payload.item_type, "finished_good");
  assert.equal(payload.metadata.usage_mode, "direct_sale");
  assert.equal(payload.metadata.order_quantity, 24);
  assert.equal(payload.metadata.maximum_stock, 120);
  assert.equal(payload.metadata.display_unit_id, "unit-kg");
  assert.equal(payload.metadata.default_waste_percent, 2.5);
  assert.equal(payload.metadata.track_expiry, true);
  assert.equal(payload.metadata.shelf_life_days, 30);
  assert.equal(payload.metadata.expiry_warning_days, 3);
  assert.throws(() => normalizeInventoryMasterDataInput("items", {
    name: "Nước suối chai",
    baseUnitId: "unit-chai",
    minimumStock: 10,
    maximumStock: 5
  }), /tồn tối đa/i);
  assert.throws(() => normalizeInventoryMasterDataInput("items", {
    name: "Nước suối chai",
    baseUnitId: "unit-chai",
    defaultWastePercent: 101
  }), /hao hụt mặc định/i);
  assert.throws(() => normalizeInventoryMasterDataInput("items", {
    name: "Nước suối chai",
    baseUnitId: "unit-chai",
    trackExpiry: true,
    shelfLifeDays: 0,
    expiryWarningDays: 3
  }), /thời hạn sử dụng/i);
  assert.throws(() => normalizeInventoryMasterDataInput("items", {
    name: "Nước suối chai",
    baseUnitId: "unit-chai",
    trackExpiry: true,
    shelfLifeDays: 7,
    expiryWarningDays: 10
  }), /số ngày cảnh báo/i);
});

test("công cụ dụng cụ giữ loại vận hành riêng mà không đổi constraint bảng", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    code: "CCDC_KHAY",
    name: "Khay inox",
    itemType: "tool",
    displayUnitId: "unit-cai",
    baseUnitId: "unit-cai"
  });
  assert.equal(payload.code, "CCDC_KHAY");
  assert.equal(payload.item_type, "other");
  assert.equal(payload.metadata.item_kind, "tool");
  assert.equal(payload.metadata.display_unit_id, "unit-cai");
});

test("chuẩn hoá dữ liệu đọc cho các màn Phase 3", () => {
  assert.deepEqual(normalizeInventoryUnit({
    symbol: " kg ",
    base_unit_id: "unit-gram",
    conversion_factor: 1000,
    display_order: 3,
    decimal_places: 9
  }), {
    id: "",
    code: "",
    name: "",
    symbol: "kg",
    unitType: "other",
    decimalPlaces: 6,
    baseUnitId: "unit-gram",
    conversionFactor: 1000,
    displayOrder: 3,
    isActive: true,
    updatedAt: ""
  });
  assert.equal(normalizeInventoryItemCategory({ description: " Gia vị " }).description, "Gia vị");
  assert.equal(normalizeInventorySupplier({ name: " NCC A " }).name, "NCC A");
  assert.equal(normalizeInventoryItem({ reorder_point: -2 }).reorderPoint, 0);
  assert.equal(normalizeInventoryItem({ item_type: "finished_good", metadata: { usage_mode: "direct_sale" } }).itemType, "direct_sale");
  assert.equal(normalizeInventoryItem({ item_type: "other", metadata: { item_kind: "tool" } }).itemType, "tool");
  assert.equal(normalizeInventoryItem({ metadata: { order_quantity: 24, maximum_stock: 120 } }).orderQuantity, 24);
  assert.equal(normalizeInventoryItem({ metadata: { order_quantity: 24, maximum_stock: 120 } }).maximumStock, 120);
  assert.equal(normalizeInventoryItem({ purchase_unit_id: "unit-kg", metadata: { display_unit_id: "unit-g" } }).displayUnitId, "unit-g");
  assert.equal(normalizeInventoryItem({ metadata: { default_waste_percent: 4.5 } }).defaultWastePercent, 4.5);
  assert.equal(normalizeInventoryItem({ metadata: { track_expiry: true, shelf_life_days: 45, expiry_warning_days: 5 } }).trackExpiry, true);
  assert.equal(normalizeInventoryItem({ metadata: { track_expiry: true, shelf_life_days: 45, expiry_warning_days: 5 } }).shelfLifeDays, 45);
  assert.equal(normalizeInventoryItem({ metadata: { track_expiry: true, shelf_life_days: 45, expiry_warning_days: 5 } }).expiryWarningDays, 5);
});

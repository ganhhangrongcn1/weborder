import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSalesRecipeComponent,
  getChannelCandidateIdentity,
  isChannelCandidateMapped,
  normalizeInventoryChannelMappingInput,
  normalizeInventorySalesRecipeInput
} from "../src/services/inventorySalesRecipeCalculations.js";
import { adminPathToState } from "../src/app/routeState.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

const units = [
  { id: "gram", name: "Gram", isActive: true },
  { id: "kg", name: "Kilôgam", baseUnitId: "gram", conversionFactor: 1000, isActive: true }
];
const items = [{ id: "item-1", name: "Xoài sơ chế", baseUnitId: "gram", purchaseUnitId: "kg", isActive: true }];
const menuEntities = [
  { id: "menu-1", name: "Bánh tráng trộn", type: "product", price: 35000 },
  { id: "menu-2", name: "Trà tắc", type: "product", price: 15000 }
];

test("quy đổi định lượng và hao hụt về đúng đơn vị tồn", () => {
  const result = calculateSalesRecipeComponent({ quantity: 1, conversionToBase: 1000, wastePercent: 10, averageCost: 50 });
  assert.equal(result.requiredBaseQuantity, 1100);
  assert.equal(result.estimatedCost, 55000);
});

test("định lượng món bán giữ liên kết bằng ID ổn định", () => {
  const result = normalizeInventorySalesRecipeInput({
    menuEntityType: "product",
    menuEntityId: "menu-1",
    yieldQuantity: 1,
    components: [{ itemId: "item-1", quantity: 0.05, unitId: "kg", wastePercent: 5 }]
  }, { menuEntities, items, units });
  assert.equal(result.menuEntityId, "menu-1");
  assert.equal(result.components[0].conversionToBase, 1000);
});

test("combo app có thể gán nhiều món Menu mà không cần tạo combo mới", () => {
  const result = normalizeInventoryChannelMappingInput({
    partnerSource: "grabfood",
    branchUuid: "branch-1",
    mappingKind: "item",
    externalItemName: "Combo 5 bịch Xâu Vò",
    targets: [{ menuEntityType: "product", menuEntityId: "menu-1", quantity: 5 }]
  }, { menuEntities });
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0].quantity, 5);
});

test("lựa chọn mức cay có thể đánh dấu không trừ kho", () => {
  const result = normalizeInventoryChannelMappingInput({
    partnerSource: "shopeefood",
    branchUuid: "branch-1",
    mappingKind: "option",
    externalItemName: "Bánh tráng trộn",
    externalOptionGroup: "Mức độ cay",
    externalOptionName: "Cay vừa",
    ignoreInventory: true
  }, { menuEntities });
  assert.deepEqual(result.targets, []);
});

test("khóa nhận diện ánh xạ có chứa kênh và chi nhánh", () => {
  const first = getChannelCandidateIdentity({ partnerSource: "grabfood", branchUuid: "a", externalItemName: "Trà tắc" });
  const second = getChannelCandidateIdentity({ partnerSource: "grabfood", branchUuid: "b", externalItemName: "Trà tắc" });
  assert.notEqual(first, second);
});

test("lựa chọn dùng chung không bị lặp theo từng món cha", () => {
  const first = getChannelCandidateIdentity({
    partnerSource: "grabfood",
    branchUuid: "a",
    candidateKind: "option",
    externalItemName: "Bánh tráng trộn",
    externalOptionGroup: "Ăn kèm",
    externalOptionName: "Trứng cút"
  });
  const second = getChannelCandidateIdentity({
    partnerSource: "grabfood",
    branchUuid: "a",
    candidateKind: "option",
    externalItemName: "Bánh tráng cuốn",
    externalOptionGroup: "Ăn kèm",
    externalOptionName: "Trứng cút"
  });
  assert.equal(first, second);
});

test("lựa chọn dùng chung không bị lặp theo từng nhóm combo", () => {
  const first = getChannelCandidateIdentity({
    partnerSource: "grabfood",
    branchUuid: "a",
    candidateKind: "option",
    externalOptionGroup: "Chọn Món Combo",
    externalOptionName: "Bánh Tráng Cuốn Bơ"
  });
  const second = getChannelCandidateIdentity({
    partnerSource: "grabfood",
    branchUuid: "a",
    candidateKind: "option",
    externalOptionGroup: "Chọn Món Combo Cuốn",
    externalOptionName: "bánh tráng cuốn bơ"
  });
  assert.equal(first, second);
});

test("ánh xạ dùng chung che mọi nhóm còn ánh xạ riêng chỉ che đúng nhóm", () => {
  const candidate = {
    partnerSource: "grabfood",
    branchUuid: "a",
    candidateKind: "option",
    externalOptionGroup: "*",
    externalOptionName: "Bánh Tráng Cuốn Bơ"
  };
  const exactMapping = [{
    partnerSource: "grabfood",
    branchUuid: "a",
    mappingKind: "option",
    externalOptionGroup: "Chọn Món Combo",
    externalOptionName: "Bánh Tráng Cuốn Bơ"
  }];
  const sharedMapping = [{ ...exactMapping[0], externalOptionGroup: "*" }];
  assert.equal(isChannelCandidateMapped(candidate, exactMapping), false);
  assert.equal(isChannelCandidateMapped(candidate, sharedMapping), true);
});

test("hậu tố cách phục vụ không tạo thêm một món cần gán", () => {
  const first = getChannelCandidateIdentity({ partnerSource: "grabfood", branchUuid: "a", externalItemName: "Combo 5 Phơi Sương Muối Tắc" });
  const second = getChannelCandidateIdentity({ partnerSource: "grabfood", branchUuid: "a", externalItemName: "Combo 5 Phơi Sương Muối Tắc (Tự Trộn)" });
  assert.equal(first, second);
});

test("món ShopeeFood dùng chung ánh xạ giữa các chi nhánh", () => {
  const first = getChannelCandidateIdentity({ partnerSource: "shopeefood", branchUuid: "a", externalItemName: "Bánh tráng trộn" });
  const second = getChannelCandidateIdentity({ partnerSource: "shopeefood", branchUuid: "b", externalItemName: "Bánh tráng trộn" });
  assert.equal(first, second);
});

test("route Định lượng món bán được mở thật trong Admin", () => {
  assert.equal(adminPathToState("/admin/inventory/sales-recipes").inventoryPage, "sales-recipes");
  assert.equal(getInventoryRoute("sales-recipes").path, "/admin/inventory/sales-recipes");
});

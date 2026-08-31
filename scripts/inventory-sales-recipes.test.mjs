import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSalesRecipeComponent,
  getInventorySalesRecipeCoverage,
  getInventorySalesRecipeScopeConflict,
  getChannelCandidateIdentity,
  isChannelCandidateMapped,
  normalizeInventoryChannelMappingInput,
  normalizeInventorySalesRecipeInput
} from "../src/services/inventorySalesRecipeCalculations.js";
import { adminPathToState } from "../src/app/routeState.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";
import { buildInventoryMenuEntities } from "../src/services/inventoryMenuEntityService.js";

const units = [
  { id: "gram", name: "Gram", isActive: true },
  { id: "kg", name: "Kilôgam", baseUnitId: "gram", conversionFactor: 1000, isActive: true }
];
const items = [{ id: "item-1", name: "Xoài sơ chế", baseUnitId: "gram", purchaseUnitId: "kg", purchaseToBaseRatio: 1000, isActive: true }];
const menuEntities = [
  { id: "menu-1", name: "Bánh tráng trộn", type: "product", price: 35000 },
  { id: "menu-2", name: "Trà tắc", type: "product", price: 15000 },
  { id: "topping-1", name: "Hành Phi", type: "topping", price: 0 }
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

test("món trùng tên có thể dùng chung một định lượng gốc", () => {
  const result = normalizeInventorySalesRecipeInput({
    menuEntityType: "topping",
    menuEntityId: "topping-1",
    recipeMode: "shared",
    sharedMenuEntityType: "product",
    sharedMenuEntityId: "menu-1",
    yieldQuantity: 1,
    components: [{ itemId: "item-1", quantity: 5, unitId: "gram" }]
  }, { menuEntities, items, units });
  assert.equal(result.sharedMenuEntityId, "menu-1");
  assert.equal(result.sharedMenuEntityName, "Bánh tráng trộn");
  assert.deepEqual(result.components, []);
});

test("không cho một món dùng chung định lượng với chính nó", () => {
  assert.throws(() => normalizeInventorySalesRecipeInput({
    menuEntityType: "product",
    menuEntityId: "menu-1",
    recipeMode: "shared",
    sharedMenuEntityType: "product",
    sharedMenuEntityId: "menu-1"
  }, { menuEntities, items, units }), /chính nó/);
});

test("combo có thể ghép nhiều định lượng gốc với số lượng riêng", () => {
  const recipes = [
    { id: "recipe-1", menuEntityType: "product", menuEntityId: "menu-1", status: "active", branchUuid: "", effectiveFrom: "2026-01-01", version: 1, sources: [] },
    { id: "recipe-2", menuEntityType: "product", menuEntityId: "menu-2", status: "active", branchUuid: "", effectiveFrom: "2026-01-01", version: 1, sources: [] }
  ];
  const result = normalizeInventorySalesRecipeInput({
    menuEntityType: "topping",
    menuEntityId: "topping-1",
    recipeMode: "composed",
    effectiveFrom: "2026-08-31",
    yieldQuantity: 1,
    sources: [
      { menuEntityType: "product", menuEntityId: "menu-1", quantity: 1 },
      { menuEntityType: "product", menuEntityId: "menu-2", quantity: 2 }
    ]
  }, { menuEntities, items, units, recipes });

  assert.deepEqual(result.components, []);
  assert.deepEqual(result.sources.map((source) => source.quantity), [1, 2]);
});

test("combo không cho lặp món gốc hoặc tạo vòng tham chiếu", () => {
  const recipes = [{
    id: "recipe-1",
    menuEntityType: "product",
    menuEntityId: "menu-1",
    status: "active",
    branchUuid: "",
    effectiveFrom: "2026-01-01",
    version: 1,
    sources: [{ menuEntityType: "topping", menuEntityId: "topping-1", quantity: 1 }]
  }];
  assert.throws(() => normalizeInventorySalesRecipeInput({
    menuEntityType: "topping",
    menuEntityId: "topping-1",
    recipeMode: "composed",
    effectiveFrom: "2026-08-31",
    sources: [{ menuEntityType: "product", menuEntityId: "menu-1", quantity: 1 }]
  }, { menuEntities, items, units, recipes }), /vòng lặp/);

  assert.throws(() => normalizeInventorySalesRecipeInput({
    menuEntityType: "topping",
    menuEntityId: "topping-1",
    recipeMode: "composed",
    effectiveFrom: "2026-08-31",
    sources: [
      { menuEntityType: "product", menuEntityId: "menu-1", quantity: 1 },
      { menuEntityType: "product", menuEntityId: "menu-1", quantity: 2 }
    ]
  }, { menuEntities, items, units, recipes: [{ ...recipes[0], sources: [] }] }), /chỉ được thêm một lần/);
});

test("trạng thái bao phủ ưu tiên đang áp dụng rồi đến bản nháp", () => {
  assert.equal(getInventorySalesRecipeCoverage(menuEntities[0], [
    { menuEntityType: "product", menuEntityId: "menu-1", status: "draft" },
    { menuEntityType: "product", menuEntityId: "menu-1", status: "active" }
  ]), "active");
  assert.equal(getInventorySalesRecipeCoverage(menuEntities[1], []), "missing");
});

test("chặn bản nháp trùng nhưng cho phép tạo phiên bản mới từ bản đang áp dụng", () => {
  const recipes = [
    { id: "draft-1", menuEntityType: "product", menuEntityId: "menu-1", branchUuid: "", status: "draft" },
    { id: "active-1", menuEntityType: "product", menuEntityId: "menu-2", branchUuid: "", status: "active" }
  ];
  assert.equal(getInventorySalesRecipeScopeConflict({ recipes, menuEntityId: "menu-1" })?.type, "draft");
  assert.equal(getInventorySalesRecipeScopeConflict({ recipes, menuEntityId: "menu-2" })?.type, "active");
  assert.equal(getInventorySalesRecipeScopeConflict({ recipes, menuEntityId: "menu-2", allowActiveVersion: true }), null);
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

test("lựa chọn trong nhóm được đưa vào danh sách định lượng mà không trộn với món cùng tên", () => {
  const entities = buildInventoryMenuEntities({
    products: [{ id: "product-cuon-bo", name: "Bánh Tráng Cuốn Bơ", price: 30000 }],
    optionGroupPresets: [{
      id: "combo-choice",
      name: "Chọn Món Combo",
      options: [
        { id: "option-cuon-bo", name: "Bánh Tráng Cuốn Bơ", price: 0, active: true },
        { id: "option-sot-me", name: "Sốt Me Bơ", price: 0, active: true }
      ]
    }]
  });

  assert.equal(entities.length, 3);
  assert.equal(entities.find((row) => row.id === "product-cuon-bo")?.type, "product");
  assert.equal(entities.find((row) => row.id === "option-cuon-bo")?.type, "topping");
  assert.equal(entities.find((row) => row.id === "option-sot-me")?.category, "Lựa chọn · Chọn Món Combo");
});

test("mức cay và cách chế biến không xuất hiện trong danh sách tạo định lượng", () => {
  const entities = buildInventoryMenuEntities({
    optionGroupPresets: [
      { id: "spice", name: "Mức Độ Cay", options: [{ id: "hot", name: "Cay Sấp Mặt", active: true }] },
      { id: "prepare", name: "Chọn Cách Chế Biến", options: [{ id: "mix", name: "Trộn Đều Topping", active: true }] },
      { id: "sauce", name: "Chọn Loại Sốt", options: [{ id: "satay", name: "Sốt Sate Bò", active: true }] }
    ]
  });

  assert.deepEqual(entities.map((row) => row.id), ["satay"]);
});

test("combo tự chọn có thể dùng chung định lượng món bán lẻ theo tỷ lệ một phần", () => {
  const result = normalizeInventoryChannelMappingInput({
    partnerSource: "grabfood",
    branchUuid: "branch-1",
    mappingKind: "option",
    externalItemName: "Combo tự chọn",
    externalOptionGroup: "Chọn Món Combo",
    externalOptionName: "Bánh Tráng Cuốn Bơ",
    targets: [{ menuEntityType: "product", menuEntityId: "menu-1", quantity: 1 }]
  }, { menuEntities });

  assert.equal(result.targets[0].menuEntityType, "product");
  assert.equal(result.targets[0].quantity, 1);
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

test("món ngưng bán là trạng thái riêng và không cần gán Menu", () => {
  const result = normalizeInventoryChannelMappingInput({
    partnerSource: "xanhngon",
    branchUuid: "branch-1",
    mappingKind: "item",
    externalItemId: "old-item-1",
    externalItemName: "Món ngưng bán",
    status: "inactive",
    ignoreInventory: false,
    notes: "Món ngưng bán"
  }, { menuEntities });
  assert.equal(result.status, "inactive");
  assert.equal(result.ignoreInventory, false);
  assert.equal(result.notes, "Món ngưng bán");
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

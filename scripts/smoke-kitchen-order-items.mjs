import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOrderItemStableId, isOrderItemUuid } from "../src/services/orderItemIdentityService.js";
import { mapWebsiteKitchenItem, resolveWebsiteKitchenItems } from "../src/services/kitchenOrderService.js";
import { buildKitchenChecklistOptionKeys, getKitchenRecipeOptions, normalizeKitchenOptionMatchText } from "../src/features/kitchen/kitchenOptionDisplay.js";
import { buildKitchenChecklistOptions } from "../src/services/kitchenOptionGroupSettingsService.js";

const comboValues = ["Bánh Tráng Cuốn Bơ", "Bánh Tráng Cuốn Chấm Sốt", "Bánh Tráng Ps Cuốn Tóp Mỡ"];
const comboGroup = "Chọn Món Combo Cuốn";
const comboLabels = comboValues.map((value) => `${comboGroup}: ${value}`);
const recipeLabels = ["Chọn Loại Sốt: Sốt Bơ Bò", "Mức Độ Cay: Không Cay", "Size: L", "Chọn Cách Chế Biến: Để riêng"];
const groupSetting = { source: "pos", groupName: comboGroup, kitchenLabel: "Chọn món combo", enabled: true };
const settingsCases = [
  { version: 3, groups: [groupSetting] },
  { version: 3, groups: comboValues.map((optionName) => ({ ...groupSetting, optionName })) }
];
for (const settings of settingsCases) {
  for (const options of [comboLabels, comboValues.map((name) => ({ groupName: comboGroup, name }))]) {
    const checklist = buildKitchenChecklistOptions(options, "pos", settings);
    assert.equal(checklist.length, 3, "All selected combo dishes must remain actionable");
    const keys = buildKitchenChecklistOptionKeys(checklist);
    const visible = getKitchenRecipeOptions([...comboLabels, ...recipeLabels])
      .filter((option) => !keys.has(normalizeKitchenOptionMatchText(option.label)))
      .map((option) => option.label);
    assert.deepEqual(visible, recipeLabels, "Renamed combo groups must not duplicate recipe badges");
    assert.equal(keys.has(normalizeKitchenOptionMatchText(`Nhóm khác: ${comboValues[0]}`)), false,
      "Equal values in different named groups must not be hidden");
    assert.equal(keys.has(normalizeKitchenOptionMatchText(comboLabels[0].replace(":", ""))), true,
      "Partner labels without separators must still match their source group");
  }
}
for (const groupName of ["Ngon Hơn Khi Ăn Cùng", "Ưu Đãi Khi Mua Kèm", "Topping thêm", "Thêm kèm"]) {
  const label = `${groupName}: Hành Phi`;
  const checklist = buildKitchenChecklistOptions([label], "pos", {
    version: 3, groups: [{ source: "pos", groupName, kitchenLabel: "Món thêm", enabled: true }]
  });
  assert.equal(checklist.length, 1);
  assert.equal(buildKitchenChecklistOptionKeys(checklist).has(normalizeKitchenOptionMatchText(label)), true);
  assert.equal(buildKitchenChecklistOptionKeys([]).has(normalizeKitchenOptionMatchText(label)), false,
    "A topping without an active checklist must stay visible");
}

assert.equal(
  normalizeKitchenOptionMatchText("Chọn Món Combo: Bánh Tráng Cuốn Bơ"),
  normalizeKitchenOptionMatchText("Chọn Món Combo Bánh Tráng Cuốn Bơ"),
  "Kitchen must match Shopee option labels with checklist labels even when the separator is omitted"
);

const orderRow = {
  id: "GHR-SMOKE-KITCHEN",
  order_code: "GHR-SMOKE-KITCHEN",
  metadata: {
    items: [
      {
        id: "product-smoke",
        cartId: "cart-smoke-1",
        name: "Món kiểm tra",
        quantity: 2,
        price: 25000,
        lineTotal: 50000,
        spice: "Mức Độ Cay: Không Cay",
        options: ["Không Cay", "Hơi Cay Cay", "Cay Sấp Mặt", "Hành Phi", "Khô Bò Đỏ"],
        toppings: [
          {
            id: "spice-none",
            name: "Không Cay",
            groupId: "spice",
            groupName: "Mức Độ Cay",
            price: 0,
            quantity: 1
          },
          {
            id: "topping-onion",
            name: "Hành Phi",
            groupId: "extras",
            groupName: "Ngon Hơn Khi Ăn Cùng",
            price: 12000,
            quantity: 1
          }
        ],
        optionGroups: [
          {
            id: "spice",
            name: "Mức Độ Cay",
            required: true,
            maxSelect: 1,
            options: [
              { id: "spice-none", name: "Không Cay", price: 0 },
              { id: "spice-medium", name: "Hơi Cay Cay", price: 0 },
              { id: "spice-hot", name: "Cay Sấp Mặt", price: 0 }
            ]
          }
        ],
        kitchenItemStatus: "pending"
      }
    ]
  }
};

const stableId = buildOrderItemStableId(orderRow.id, orderRow.metadata.items[0], 0);
assert.equal(isOrderItemUuid(stableId), true, "Fallback item id must be a valid UUID");
assert.equal(
  stableId,
  buildOrderItemStableId(orderRow.id, orderRow.metadata.items[0], 0),
  "Fallback item id must be deterministic"
);

const fallbackItems = resolveWebsiteKitchenItems(orderRow, new Map());
assert.equal(fallbackItems.length, 1, "Kitchen must use metadata items when order_items is empty");
assert.equal(fallbackItems[0].name, "Món kiểm tra");
assert.equal(fallbackItems[0].quantity, 2);
assert.equal(fallbackItems[0].raw.__metadataFallback, true);
assert.equal(fallbackItems[0].options.includes("Mức Độ Cay: Không Cay"), true);
assert.equal(fallbackItems[0].options.includes("Ngon Hơn Khi Ăn Cùng: Hành Phi"), true);
assert.equal(fallbackItems[0].options.some((option) => option.includes("Hơi Cay Cay")), false);
assert.equal(fallbackItems[0].options.some((option) => option.includes("Cay Sấp Mặt")), false);
assert.equal(fallbackItems[0].options.some((option) => option.includes("Khô Bò Đỏ")), false);

const legacyRepairedItem = mapWebsiteKitchenItem({
  id: stableId,
  order_id: orderRow.id,
  product_id: "product-smoke",
  product_name: "Món kiểm tra",
  quantity: 2,
  toppings: orderRow.metadata.items[0].toppings,
  option_groups: orderRow.metadata.items[0].optionGroups,
  spice: orderRow.metadata.items[0].spice,
  metadata: orderRow.metadata.items[0]
});
assert.equal(legacyRepairedItem.options.includes("Mức Độ Cay: Không Cay"), true);
assert.equal(legacyRepairedItem.options.includes("Ngon Hơn Khi Ăn Cùng: Hành Phi"), true);
assert.equal(legacyRepairedItem.options.some((option) => option.includes("Hơi Cay Cay")), false);
assert.equal(legacyRepairedItem.options.some((option) => option.includes("Cay Sấp Mặt")), false);
assert.equal(legacyRepairedItem.options.some((option) => option.includes("Khô Bò Đỏ")), false);

const storedItems = [{ id: "stored-item", name: "Món từ bảng chuẩn" }];
const resolvedStoredItems = resolveWebsiteKitchenItems(orderRow, new Map([[orderRow.id, storedItems]]));
assert.equal(resolvedStoredItems, storedItems, "Kitchen must prefer stored order_items");

const repositorySource = await readFile(
  new URL("../src/services/repositories/coreSupabaseRepository.js", import.meta.url),
  "utf8"
);
assert.equal(
  repositorySource.includes('.from("order_items").delete().eq("order_id", orderRow.id)'),
  false,
  "Single-order writes must not delete all item rows before inserting replacements"
);
assert.equal(
  repositorySource.includes('.from("order_items").delete().in("order_id", orderIds)'),
  false,
  "Bulk order writes must not delete all item rows before inserting replacements"
);

console.log("Kitchen order item smoke passed.");

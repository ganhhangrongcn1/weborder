import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOrderItemStableId, isOrderItemUuid } from "../src/services/orderItemIdentityService.js";
import { mapWebsiteKitchenItem, resolveWebsiteKitchenItems } from "../src/services/kitchenOrderService.js";

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

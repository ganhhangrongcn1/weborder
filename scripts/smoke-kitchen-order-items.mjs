import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOrderItemStableId, isOrderItemUuid } from "../src/services/orderItemIdentityService.js";
import { resolveWebsiteKitchenItems } from "../src/services/kitchenOrderService.js";

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

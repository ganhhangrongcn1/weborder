import assert from "node:assert/strict";
import { test } from "node:test";
import readOrderItemPages from "../src/services/supabase/readOrderItemPages.js";

function mockClient(rows, { cap = 1000, failOffset = -1 } = {}) {
  const requests = [];
  return {
    requests,
    from(table) {
      let selected;
      return {
        select() { return this; },
        in(column, ids) {
          selected = rows.filter((row) => ids.includes(row[column]));
          return this;
        },
        order() { selected.sort((a, b) => a.id.localeCompare(b.id)); return this; },
        range(from, to) {
          requests.push({ table, from, to });
          return Promise.resolve({
            data: selected.slice(from, Math.min(to + 1, from + cap)),
            count: selected.length,
            error: from === failOffset ? new Error("read failed") : null
          });
        }
      };
    }
  };
}

test("loads all items beyond the API limit, including the final order", async () => {
  const rows = Array.from({ length: 1003 }, (_, i) => ({
    id: String(i).padStart(5, "0"), order_id: i < 1000 ? "earlier" : "latest"
  }));
  const client = mockClient(rows);
  const result = await readOrderItemPages(client, { columns: "*", orderIds: ["earlier", "latest"] });
  assert.equal(result.length, 1003);
  assert.equal(result.filter((row) => row.order_id === "latest").length, 3);
  assert.equal(new Set(result.map((row) => row.id)).size, 1003);
});

test("handles smaller server caps and scopes partner items to deduplicated order batches", async () => {
  const rows = Array.from({ length: 205 }, (_, i) => ({ id: String(i), partner_order_id: `order-${i}` }));
  const client = mockClient(rows, { cap: 40 });
  const result = await readOrderItemPages(client, {
    table: "partner_order_items", orderIdColumn: "partner_order_id", columns: "*",
    orderIds: [...rows.map((row) => row.partner_order_id), "order-0"]
  });
  assert.equal(result.length, 205);
  assert.equal(new Set(result.map((row) => row.id)).size, 205);
  assert.ok(client.requests.every((request) => request.table === "partner_order_items"));
});

test("does not return partial data when a later page fails", async () => {
  const client = mockClient(Array.from({ length: 501 }, (_, i) => ({ id: String(i), order_id: "one" })), { failOffset: 500 });
  await assert.rejects(readOrderItemPages(client, { columns: "*", orderIds: ["one"] }), /read failed/);
});

test("empty order scope makes no requests", async () => {
  const client = mockClient([]);
  assert.deepEqual(await readOrderItemPages(client, { columns: "*" }), []);
  assert.equal(client.requests.length, 0);
});

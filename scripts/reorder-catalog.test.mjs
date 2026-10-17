import assert from "node:assert/strict";
import test from "node:test";
import { buildReorderItems, findOrderCatalogProduct, getUnavailableOrderItems } from "../src/services/reorderService.js";

const products = [
  { id: "roll", name: "Cuốn Bơ", price: 49000 },
  { id: "tea", name: "Trà Tắc", price: 15000 },
  { id: "hidden", name: "Món đã ẩn", price: 39000, visible: false },
  { id: "inactive", name: "Món ngừng bán", price: 39000, active: false }
];

test("removed combo cannot be replaced by its similarly named single dish", () => {
  const item = { id: "removed-combo", name: "Combo Cuốn Bơ + Trà Tắc", price: 39000 };
  assert.equal(findOrderCatalogProduct(item, products), null);
  assert.throws(() => buildReorderItems({ items: [item] }, products), { code: "ORDER_ITEMS_UNAVAILABLE" });
});

test("an explicit removed ID cannot fall back to a new product with the same name", () => {
  assert.equal(findOrderCatalogProduct({ id: "deleted", name: "Cuốn Bơ" }, products), null);
  assert.equal(findOrderCatalogProduct({ productId: "tea", id: "order-line" }, products).id, "tea");
});

test("legacy items without IDs require a unique exact name, including Vietnamese accents", () => {
  assert.equal(findOrderCatalogProduct({ name: "  Cuốn Bơ " }, products).id, "roll");
  assert.equal(findOrderCatalogProduct({ name: "Cuon Bo" }, products), null);
  assert.equal(findOrderCatalogProduct({ name: "Cuốn Bơ" }, [...products, { id: "another", name: "Cuốn Bơ" }]), null);
});

test("mixed orders fail as a whole and preserve the historical order", () => {
  const order = { items: [{ id: "roll", price: 39000 }, { id: "hidden", name: "Món đã ẩn" }] };
  const original = structuredClone(order);
  assert.throws(() => buildReorderItems(order, products), (error) => {
    assert.equal(error.unavailableItems.length, 1);
    assert.match(error.message, /Món đã ẩn/);
    return true;
  });
  assert.deepEqual(order, original);
});

test("empty menu, hidden and inactive products block reorder", () => {
  for (const id of ["hidden", "inactive"]) {
    assert.throws(() => buildReorderItems({ items: [{ id }] }, products), { code: "ORDER_ITEMS_UNAVAILABLE" });
  }
  assert.throws(() => buildReorderItems({ items: [{ id: "roll" }] }, []), { code: "ORDER_ITEMS_UNAVAILABLE" });
});

test("available dishes use current prices and preserve quantity, notes and toppings", () => {
  const item = { id: "roll", price: 39000, quantity: 2, note: "Nhiều bơ", toppings: [{ id: "extra", price: 5000, quantity: 2 }] };
  const [next] = buildReorderItems({ items: [item] }, products);
  assert.equal(next.price, 49000);
  assert.equal(next.unitTotal, 59000);
  assert.equal(next.lineTotal, 118000);
  assert.equal(next.note, item.note);
  assert.deepEqual(next.toppings, item.toppings);
});

test("branch and channel restrictions reuse the menu availability policy", () => {
  const restricted = [{ id: "roll", availability: { branchChannels: { branch1: ["web"], branch2: ["pos"] } } }];
  assert.equal(getUnavailableOrderItems([{ id: "roll" }], restricted, { branchValue: "branch1", channel: "web" }).length, 0);
  assert.equal(getUnavailableOrderItems([{ id: "roll" }], restricted, { branchValue: "branch2", channel: "web" }).length, 1);
  assert.equal(getUnavailableOrderItems([{ id: "roll" }], restricted, { branchValue: "branch1", channel: "qr" }).length, 1);
});

test("old promotional and stamp gifts are excluded without blocking normal dishes", () => {
  const items = [{ id: "roll" }, { id: "old-gift", autoGiftByPromo: true }, { id: "stamp", stampGift: true }];
  assert.equal(buildReorderItems({ items }, products).length, 1);
  assert.equal(getUnavailableOrderItems(items, products).length, 0);
  assert.deepEqual(buildReorderItems({ items: items.slice(1) }, products), []);
});

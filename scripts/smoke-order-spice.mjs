import assert from "node:assert/strict";
import { makeCartItem } from "../src/features/cart/cartItemFactory.js";
import { sanitizeOrderSpice } from "../src/utils/orderSpice.js";

const optionalToppingProduct = {
  id: "product-cuon-bo",
  name: "Bánh Tráng Cuốn Bơ",
  price: 20000,
  optionGroups: [
    {
      id: "extras",
      name: "Ngon Hơn Khi Ăn Cùng",
      type: "multiple",
      required: false,
      options: [{ id: "onion", name: "Hành Phi", price: 12000 }]
    }
  ]
};

const spiceProduct = {
  id: "product-spice",
  name: "Món có độ cay",
  price: 30000,
  optionGroups: [
    {
      id: "spice",
      name: "Mức Độ Cay",
      type: "single",
      required: true,
      options: [
        { id: "none", name: "Không Cay", price: 0 },
        { id: "medium", name: "Hơi Cay Cay", price: 0 }
      ]
    }
  ]
};

assert.equal(sanitizeOrderSpice(optionalToppingProduct, "Vừa cay"), "");
assert.equal(sanitizeOrderSpice(spiceProduct, "Mức Độ Cay: Hơi Cay Cay"), "Mức Độ Cay: Hơi Cay Cay");
assert.equal(sanitizeOrderSpice(spiceProduct, "hơi cay cay"), "Mức Độ Cay: Hơi Cay Cay");
assert.equal(sanitizeOrderSpice(spiceProduct, "Vừa cay"), "");

const cartItem = makeCartItem(optionalToppingProduct, "Vừa cay", [], 1);
assert.equal(cartItem.spice, "", "Món không có nhóm độ cay không được mang spice mặc định cũ");
assert.deepEqual(cartItem.toppings, [], "Việc làm sạch spice không được thay đổi topping");

console.log("Order spice smoke passed.");

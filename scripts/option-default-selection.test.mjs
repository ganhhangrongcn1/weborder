import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultOrderChoices } from "../src/utils/pureHelpers.js";

const comboOptions = [
  { id: "cuon-bo", name: "Bánh Tráng Cuốn Bơ", price: 0 },
  { id: "tron", name: "Bánh Tráng Trộn Đặc Biệt", price: 0 },
  { id: "cham", name: "Bánh Tráng Chấm Gánh", price: 0 }
];

test("preselects every option when an exact required group is 3 of 3", () => {
  const defaults = getDefaultOrderChoices({
    optionGroups: [{
      id: "combo",
      name: "Chọn Món Combo",
      type: "multiple",
      required: true,
      selectionMode: "exact",
      maxSelect: 3,
      options: comboOptions
    }]
  });

  assert.deepEqual(
    defaults.toppings.map((option) => option.id),
    ["cuon-bo", "tron", "cham"]
  );
});

test("does not preselect all for an exact 2 of 3 group", () => {
  const defaults = getDefaultOrderChoices({
    optionGroups: [{
      id: "combo",
      name: "Chọn Món Combo",
      type: "multiple",
      required: true,
      selectionMode: "exact",
      maxSelect: 2,
      options: comboOptions
    }]
  });

  assert.deepEqual(defaults.toppings, []);
});

test("does not preselect all when 3 is only the maximum", () => {
  const defaults = getDefaultOrderChoices({
    optionGroups: [{
      id: "topping",
      name: "Ăn kèm",
      type: "multiple",
      required: true,
      selectionMode: "max",
      maxSelect: 3,
      options: comboOptions
    }]
  });

  assert.deepEqual(defaults.toppings, []);
});

test("keeps the existing paid single-option default without duplicates", () => {
  const defaults = getDefaultOrderChoices({
    optionGroups: [{
      id: "size",
      name: "Chọn size",
      type: "single",
      required: true,
      selectionMode: "exact",
      maxSelect: 1,
      options: [{ id: "large", name: "Size lớn", price: 5000 }]
    }]
  });

  assert.equal(defaults.toppings.length, 1);
  assert.equal(defaults.toppings[0].id, "large");
});

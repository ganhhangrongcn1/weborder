import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchText } from "../src/features/menu/menuSearch.js";

test("customers can find title-cased egg dishes with Vietnamese and unaccented queries", () => {
  const name = "Trứng Cút Lòng Đào Rim Me";
  for (const query of ["lòng đào", "long dao", "LÒNG ĐÀO", "trứng cút lòng đào", "TRUNG CUT LONG DAO"]) {
    assert.ok(normalizeSearchText(name).includes(normalizeSearchText(query)), query);
  }
});

test("decomposed Vietnamese text matches and unrelated dishes stay unmatched", () => {
  assert.equal(normalizeSearchText("Lòng Đào".normalize("NFD")), normalizeSearchText("lòng đào"));
  assert.equal(normalizeSearchText("Bánh Tráng Bơ").includes(normalizeSearchText("lòng đào")), false);
  assert.equal(normalizeSearchText(undefined), "");
});

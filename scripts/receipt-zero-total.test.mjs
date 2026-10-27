import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { normalizeReceiptLoyaltyDisplay as normalize } from "../src/services/receiptLoyaltyDisplayService.js";

const zero = { status: "waiting_data", totalAmount: 0, pointsBaseAmount: 0, points: 0, orderCode: "GHR-7526", createdAt: "2026-10-27T03:23:17Z" };
assert.equal(normalize(zero).status, "not_eligible");
assert.equal(normalize({ ...zero, status: "expired" }).status, "not_eligible");
for (const status of ["claimed", "cancelled"]) assert.equal(normalize({ ...zero, status }).status, status);
for (const patch of [{ totalAmount: 30000 }, { pointsBaseAmount: 30000 }, { points: 3000 }, { totalAmount: null }, { totalAmount: undefined }]) {
  assert.equal(normalize({ ...zero, ...patch }).status, "waiting_data", "do not hide genuine reconciliation or unknown data");
}
const compiled = transformSync(fs.readFileSync(new URL("../src/pages/ReceiptLoyaltyPage.jsx", import.meta.url), "utf8"), { loader: "jsx", format: "cjs", jsx: "automatic" }).code;
function render(receipt) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return { ...React, useEffect() {}, useState: () => ["claim", () => {}] };
    if (name === "react-router-dom") return { Link: ({ to, children, ...props }) => React.createElement("a", { ...props, href: to }, children), useParams: () => ({ token: "a".repeat(64) }) };
    if (name.endsWith(".css")) return {};
    if (name.includes("useReceiptLoyalty")) return { __esModule: true, default: () => ({ receipt: normalize(receipt), loading: false, clearError() {} }) };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
const html = render(zero);
assert.match(html, /Đơn 0đ không tích thêm điểm hoặc tem/);
assert.doesNotMatch(html, /chờ đối soát|Kiểm tra lại bill|Điểm của đơn này|Số điện thoại nhận điểm/);
assert.match(render({ ...zero, totalAmount: 30000 }), /chờ đối soát/);
assert.match(render({ ...zero, status: "cancelled" }), /Bill đã hủy/);
console.log("Zero receipt display: zero, unknown, reconciliation, expiry and cancellation checks passed");

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBranchChannelMatrix,
  buildProductAvailabilityPatch,
  isProductAvailableForContext
} from "../src/services/productAvailabilityService.js";

const branches = [
  { branch_uuid: "branch-304", name: "Đường 30/4" },
  { branch_uuid: "branch-tqd", name: "Thích Quảng Đức" },
  { branch_uuid: "branch-lhp", name: "Lê Hồng Phong" }
];

test("legacy availability becomes an equivalent branch-channel matrix", () => {
  const matrix = buildBranchChannelMatrix({ branchIds: ["branch-304"], channels: ["web", "pos"] }, branches);
  assert.deepEqual(matrix["branch-304"], ["web", "pos"]);
  assert.deepEqual(matrix["branch-tqd"], []);
  assert.deepEqual(matrix["branch-lhp"], []);
});

test("matrix can disable website while keeping QR and POS per branch", () => {
  const availability = buildProductAvailabilityPatch({
    branchChannels: {
      "branch-304": ["web", "qr", "pos"],
      "branch-tqd": ["qr", "pos"],
      "branch-lhp": ["qr", "pos"]
    }
  });
  const product = { visible: true, availability };

  assert.equal(isProductAvailableForContext(product, { branchValue: "branch-304", channel: "web" }), true);
  assert.equal(isProductAvailableForContext(product, { branchValue: "branch-tqd", channel: "web" }), false);
  assert.equal(isProductAvailableForContext(product, { branchValue: "branch-tqd", channel: "qr" }), true);
  assert.equal(isProductAvailableForContext(product, { branchValue: "branch-lhp", channel: "pos" }), true);
});

test("a branch absent from an explicit matrix is unavailable by default", () => {
  const product = {
    availability: buildProductAvailabilityPatch({ branchChannels: { "branch-304": ["web"] } })
  };
  assert.equal(isProductAvailableForContext(product, { branchValue: "branch-new", channel: "web" }), false);
});

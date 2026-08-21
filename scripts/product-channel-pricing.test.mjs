import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductChannelPriceMetadata,
  resolveStoreProductPrice,
  resolveWebsiteProductPrice
} from "../src/services/productChannelPricingService.js";

test("legacy products keep one safe price for both channels", () => {
  const product = { price: 39000 };
  assert.equal(resolveWebsiteProductPrice(product), 39000);
  assert.equal(resolveStoreProductPrice(product), 39000);
});

test("website and POS prices stay independent", () => {
  const databaseRow = {
    price: 39000,
    metadata: { webPrice: 49000, posPrice: 39000 }
  };
  assert.equal(resolveWebsiteProductPrice(databaseRow), 49000);
  assert.equal(resolveStoreProductPrice(databaseRow), 39000);
});

test("saving keeps the website price in metadata and the store price separately", () => {
  const metadata = buildProductChannelPriceMetadata({
    id: "mon-1",
    price: 49000,
    posPrice: 39000,
    metadata: { availability: { channels: ["web", "pos"] } }
  });
  assert.equal(metadata.webPrice, 49000);
  assert.equal(metadata.posPrice, 39000);
  assert.deepEqual(metadata.availability, { channels: ["web", "pos"] });
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSmartPromotion } from "../src/utils/pureHelpers.js";
import { normalizeFlashPromo, FLASH_APPLY_SCOPE_OPTIONS } from "../src/pages/admin/promotions/promotionTabUtils.js";
import { isPromotionAllowedForChannel } from "../src/services/promotionChannelService.js";

test("branch-scoped flash sale survives admin normalization and stays POS-only", () => {
  const branchIds = ["b108f000-02dc-4f04-8a97-996bbfc27fb8"];
  const source = {
    id: "vietsing-19k", type: "flash_sale", salesChannels: ["web", "pos"],
    condition: { applyScope: "all", branchIds, exactFixedPrice: true },
    reward: { type: "fixed_price", value: 19000 }
  };
  const saved = normalizeSmartPromotion(source);
  const displayed = normalizeFlashPromo(saved, { condition: {}, reward: {} });
  assert.deepEqual(saved.salesChannels, ["pos"]);
  assert.deepEqual(displayed.condition.branchIds, branchIds);
  assert.equal(displayed.condition.applyScope, "all");
  assert.equal(displayed.condition.exactFixedPrice, true);
  assert.equal(isPromotionAllowedForChannel(saved, "web"), false);
  assert.equal(FLASH_APPLY_SCOPE_OPTIONS.some((item) => item.value === "all"), true);
});

test("global flash sale keeps its original channel selection", () => {
  const saved = normalizeSmartPromotion({ id: "global", type: "flash_sale", salesChannels: ["web", "pos"] });
  assert.deepEqual(saved.salesChannels, ["web", "pos"]);
});

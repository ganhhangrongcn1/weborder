jest.mock("../src/services/supabase/client", () => ({ supabase: null }));

import { isPosProductAvailableForBranch, resolvePosProductPrice } from "../src/services/pos/posProductService";

describe("POS product availability by branch", () => {
  const product = {
    availability: {
      branchChannels: {
        "branch-304": ["web", "qr", "pos"],
        "branch-tqd": ["web", "qr"],
        "branch-lhp": ["qr", "pos"]
      }
    }
  };

  it("keeps POS enabled only for branches whose matrix includes POS", () => {
    expect(isPosProductAvailableForBranch(product, "branch-304")).toBe(true);
    expect(isPosProductAvailableForBranch(product, "branch-tqd")).toBe(false);
    expect(isPosProductAvailableForBranch(product, "branch-lhp")).toBe(true);
  });

  it("keeps legacy branch and channel rules compatible", () => {
    expect(isPosProductAvailableForBranch({
      availability: { branchIds: ["branch-304"], channels: ["web", "pos"] }
    }, "branch-304")).toBe(true);
    expect(isPosProductAvailableForBranch({
      availability: { branchIds: ["branch-304"], channels: ["web", "pos"] }
    }, "branch-lhp")).toBe(false);
  });

  it("uses the dedicated POS price and safely falls back to the website price", () => {
    expect(resolvePosProductPrice({ price: 49000, metadata: { posPrice: 39000 } })).toBe(39000);
    expect(resolvePosProductPrice({ price: 49000, metadata: {} })).toBe(49000);
    expect(resolvePosProductPrice({ price: 49000, metadata: { pos_price: 41000 } })).toBe(41000);
  });
});

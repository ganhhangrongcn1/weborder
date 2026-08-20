jest.mock("../src/services/supabase/client", () => ({ supabase: null }));

import { isPosProductAvailableForBranch } from "../src/services/pos/posProductService";

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
});

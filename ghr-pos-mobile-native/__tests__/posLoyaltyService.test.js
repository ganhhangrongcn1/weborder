/* global jest, describe, beforeEach, it, expect */

jest.mock("../src/services/supabase/client", () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn()
  }
}));

jest.mock("../src/services/pos/posCustomerService", () => ({
  normalizeCustomerPhone: (phone = "") => String(phone).replace(/\D/g, "")
}));

import { supabase } from "../src/services/supabase/client";
import { applyPosOrderLoyaltyMobile } from "../src/services/pos/posLoyaltyService";

describe("applyPosOrderLoyaltyMobile", () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
    supabase.from.mockReset();
  });

  it("không tự cộng điểm thưởng khi đơn POS hoàn tất", async () => {
    const result = await applyPosOrderLoyaltyMobile({
      phone: "0788422424",
      orderId: "POS-TEST-001",
      amount: 47000,
      orderStatus: "done",
      loyaltyRule: {
        currencyPerPoint: 100,
        pointPerUnit: 12
      }
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pointsEarned: 0,
      pointsSpent: 0
    }));
  });

  it("vẫn ghi nhận dùng điểm tại POS", async () => {
    supabase.rpc.mockResolvedValue({
      data: [{
        ok: true,
        applied: true,
        action: "SPEND",
        points_delta: -7000
      }],
      error: null
    });

    const result = await applyPosOrderLoyaltyMobile({
      phone: "0788422424",
      orderId: "POS-TEST-002",
      amount: 40000,
      pointsDiscount: 7000
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "process_order_loyalty",
      {
        p_source_type: "ORDER",
        p_source_order_id: "POS-TEST-002",
        p_action: "SPEND",
        p_idempotency_key: "loyalty-v2:ORDER:POS-TEST-002:SPEND:v1"
      }
    );
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pointsEarned: 0,
      pointsSpent: 7000,
      spendApplied: true
    }));
  });
});

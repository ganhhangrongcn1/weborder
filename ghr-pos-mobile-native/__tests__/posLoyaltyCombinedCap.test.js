import { buildPosLoyaltyBenefit, buildVoucherSelectionKey } from "../src/shared/pos/posLoyalty";

const employeeCoupon = {
  id: "employee", code: "NHANVIEN", source: "checkout",
  discountType: "percent", value: 20, active: true, salesChannels: ["pos"]
};

function benefit({ subtotal = 25000, percent = 30, balance = 100000, coupon = employeeCoupon } = {}) {
  return buildPosLoyaltyBenefit({
    subtotal,
    coupons: coupon ? [coupon] : [],
    selectedVoucherId: coupon ? buildVoucherSelectionKey(coupon) : "",
    pointsInput: "100000",
    customer: {
      loyalty: { totalPoints: balance },
      loyaltyRule: { maxRedemptionPercent: percent, redeemPointUnit: 1, redeemValue: 1 }
    }
  });
}

describe("POS combined voucher and points limit", () => {
  it.each([[25000, 5000], [50000, 10000], [100000, 20000]])(
    "keeps NHANVIEN and every point suggestion inside the server ceiling for %i",
    (subtotal, maxPoints) => {
      const result = benefit({ subtotal });
      expect(result.usablePoints).toBe(maxPoints);
      expect(result.pointsSpent).toBe(maxPoints);
      expect(result.voucherDiscount + result.pointsDiscount).toBe(subtotal * 0.4);
      expect(result.pointSuggestions.length).toBeGreaterThan(0);
      for (const suggestion of result.pointSuggestions) {
        expect(suggestion.points).toBeLessThanOrEqual(maxPoints);
      }
    }
  );

  it("keeps a lower configured redemption limit", () => {
    expect(benefit({ subtotal: 100000, percent: 10 }).pointsSpent).toBe(8000);
  });

  it("respects available balance and rounds down to the spend step", () => {
    expect(benefit({ balance: 4600 }).pointsSpent).toBe(4000);
  });

  it("caps points alone at the server ceiling even with a higher CRM setting", () => {
    expect(benefit({ subtotal: 100000, percent: 50, coupon: null }).pointsSpent).toBe(40000);
  });

  it.each([40, 50])("offers no points when the voucher uses %i percent", (value) => {
    const result = benefit({ coupon: { ...employeeCoupon, value } });
    expect(result.pointsSpent).toBe(0);
    expect(result.pointSuggestions).toEqual([]);
  });

  it("recalculates the point maximum when the voucher changes", () => {
    expect(benefit({ subtotal: 100000, coupon: null }).usablePoints).toBe(30000);
    expect(benefit({ subtotal: 100000 }).usablePoints).toBe(20000);
  });
});

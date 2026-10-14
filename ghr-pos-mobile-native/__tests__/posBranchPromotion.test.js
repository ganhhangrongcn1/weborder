import { applyPosPricePromotionToProduct } from "../src/shared/pos/posPromotions";
import { calculatePosCartTotals, createPosCartItem } from "../src/shared/pos/posCart";
import { buildPosLoyaltyBenefit } from "../src/shared/pos/posLoyalty";
import { fetchPosCatalogConfig } from "../src/services/pos/posCatalogConfigService";
import { supabase } from "../src/services/supabase/client";

jest.mock("../src/services/supabase/client", () => ({ supabase: { from: jest.fn() } }));

const vietsing = "b108f000-02dc-4f04-8a97-996bbfc27fb8";
const otherBranch = "c0d35bd0-e614-4973-9eb2-17e78fb9a245";
const program = {
  id: "vietsing-19k",
  type: "flash_sale",
  active: true,
  salesChannels: ["pos"],
  startAt: "2026-10-09",
  endAt: "2026-10-11",
  priority: 1,
  condition: {
    branchIds: [vietsing],
    applyScope: "all",
    exactFixedPrice: true,
    useTimeWindow: false,
    weekdays: [],
    totalSlots: 0,
    noStackWithOtherPromotions: false
  },
  reward: { type: "fixed_price", value: 19000, roundMode: "none" }
};
const product = { id: "banh-trang", name: "Bánh tráng", price: 35000 };
const now = new Date("2026-10-10T12:00:00");

describe("branch-scoped POS menu prices", () => {
  it("preserves branch scope and exact pricing when loading the remote catalog", async () => {
    supabase.from.mockImplementation((table) => ({
      select: () => ({
        order: async () => ({ data: table === "smart_promotions" ? [{ id: 1, data: program }] : [], error: null })
      })
    }));
    const catalog = await fetchPosCatalogConfig();
    expect(catalog.ok).toBe(true);
    expect(catalog.smartPromotions[0].condition.branchIds).toEqual([vietsing]);
    expect(catalog.smartPromotions[0].condition.exactFixedPrice).toBe(true);
    expect(applyPosPricePromotionToProduct(product, catalog.smartPromotions, now, otherBranch)).toBe(product);
  });

  it.each(["2026-10-09T00:00:00", "2026-10-10T12:00:00", "2026-10-11T23:59:59"])(
    "applies the program during all three days: %s",
    (time) => expect(applyPosPricePromotionToProduct(product, [program], new Date(time), vietsing).price).toBe(19000)
  );

  it.each([otherBranch, "", undefined])("does not discount another or unknown branch: %s", (branch) => {
    expect(applyPosPricePromotionToProduct(product, [program], now, branch)).toBe(product);
  });

  it.each(["2026-10-08T23:59:59", "2026-10-12T00:00:00"])("keeps the normal price outside the dates: %s", (time) => {
    expect(applyPosPricePromotionToProduct(product, [program], new Date(time), vietsing)).toBe(product);
  });

  it.each([10000, 19000, 35000])("sets the exact fixed price for original price %s", (price) => {
    expect(applyPosPricePromotionToProduct({ ...product, price }, [program], now, vietsing).price).toBe(19000);
  });

  it("keeps older discount-only fixed-price programs unchanged", () => {
    const legacy = { ...program, condition: { ...program.condition, exactFixedPrice: false, branchIds: [] } };
    expect(applyPosPricePromotionToProduct({ ...product, price: 10000 }, [legacy], now).price).toBe(10000);
  });

  it("fails closed for malformed branch scope", () => {
    const invalid = { ...program, condition: { ...program.condition, branchIds: vietsing } };
    expect(applyPosPricePromotionToProduct(product, [invalid], now, vietsing)).toBe(product);
  });

  it("does not apply on POS when only Web is enabled or the program is off", () => {
    expect(applyPosPricePromotionToProduct(product, [{ ...program, salesChannels: ["web"] }], now, vietsing)).toBe(product);
    expect(applyPosPricePromotionToProduct(product, [{ ...program, active: false }], now, vietsing)).toBe(product);
  });

  it("adds toppings and options separately, then allows loyalty point redemption", () => {
    const priced = applyPosPricePromotionToProduct(product, [program], now, vietsing);
    const item = createPosCartItem(priced, {
      quantity: 2,
      toppings: [{ name: "Trứng cút", price: 5000, quantity: 2 }],
      selectedOptions: [{ groupName: "Phần thêm", name: "Thêm sốt", price: 2000 }]
    });
    const totals = calculatePosCartTotals([item]);
    expect(item.price).toBe(19000);
    expect(item.unitTotal).toBe(31000);
    expect(totals.subtotal).toBe(62000);
    const benefit = buildPosLoyaltyBenefit({
      subtotal: totals.subtotal,
      branchId: vietsing,
      pointsInput: "10000",
      customer: {
        loyalty: { totalPoints: 50000 },
        loyaltyRule: { redeemPointUnit: 1, redeemValue: 1, maxRedemptionPercent: 50 }
      }
    });
    expect(benefit.pointsSpent).toBe(10000);
    expect(benefit.pointsDiscount).toBe(10000);
    expect(totals.subtotal - benefit.pointsDiscount).toBe(52000);
  });
});

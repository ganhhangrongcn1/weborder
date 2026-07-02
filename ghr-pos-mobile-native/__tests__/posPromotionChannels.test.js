import { buildPosLoyaltyBenefit } from "../src/shared/pos/posLoyalty";
import {
  applyPosFlashSaleToProduct,
  buildPosPromotionHints
} from "../src/shared/pos/posPromotions";

const product = {
  id: "p-tra-xoai",
  name: "Tra Xoai",
  category: "Tra",
  price: 35000
};

function buildFlashPromotion(salesChannels = ["pos"]) {
  return {
    id: "flash-1",
    type: "flash_sale",
    active: true,
    salesChannels,
    startAt: "2020-01-01",
    endAt: "2099-12-31",
    condition: {
      applyScope: "product",
      productIds: product.id,
      startTime: "00:00",
      endTime: "23:59",
      totalSlots: 0,
      soldCount: 0
    },
    reward: {
      type: "fixed_discount",
      value: 10000
    }
  };
}

function buildGiftPromotion(salesChannels = ["pos"]) {
  return {
    id: "gift-1",
    type: "gift_threshold",
    active: true,
    salesChannels,
    startAt: "2020-01-01",
    endAt: "2099-12-31",
    condition: {
      minSubtotal: 80000
    },
    reward: {
      type: "gift",
      productId: product.id
    }
  };
}

describe("POS promotion sales channels", () => {
  it("does not apply flash sale when POS channel is off", () => {
    const result = applyPosFlashSaleToProduct(
      product,
      [buildFlashPromotion(["web", "qr"])],
      new Date("2026-07-02T10:00:00")
    );

    expect(result.price).toBe(35000);
    expect(result.flashPromoId).toBeUndefined();
  });

  it("applies flash sale when POS channel is on", () => {
    const result = applyPosFlashSaleToProduct(
      product,
      [buildFlashPromotion(["pos"])],
      new Date("2026-07-02T10:00:00")
    );

    expect(result.price).toBe(25000);
    expect(result.flashPromoId).toBe("flash-1");
  });

  it("does not suggest auto gift when POS channel is off", () => {
    const hints = buildPosPromotionHints({
      smartPromotions: [buildGiftPromotion(["web", "qr"])],
      products: [product],
      subtotal: 90000
    });

    expect(hints).toEqual([]);
  });

  it("suggests auto gift when POS channel is on", () => {
    const hints = buildPosPromotionHints({
      smartPromotions: [buildGiftPromotion(["pos"])],
      products: [product],
      subtotal: 90000
    });

    expect(hints).toHaveLength(1);
    expect(hints[0]).toEqual(expect.objectContaining({
      id: "gift-1",
      eligible: true,
      productId: product.id
    }));
  });

  it("does not show checkout voucher when POS channel is off", () => {
    const benefit = buildPosLoyaltyBenefit({
      subtotal: 100000,
      coupons: [{
        id: "coupon-web-only",
        code: "WEB10",
        active: true,
        discountType: "fixed",
        value: 10000,
        salesChannels: ["web", "qr"]
      }]
    });

    expect(benefit.checkoutVouchers).toEqual([]);
    expect(benefit.availableVouchers).toEqual([]);
  });

  it("shows checkout voucher when POS channel is on", () => {
    const benefit = buildPosLoyaltyBenefit({
      subtotal: 100000,
      coupons: [{
        id: "coupon-pos",
        code: "POS10",
        active: true,
        discountType: "fixed",
        value: 10000,
        salesChannels: ["pos"]
      }]
    });

    expect(benefit.checkoutVouchers).toHaveLength(1);
    expect(benefit.checkoutVouchers[0].code).toBe("POS10");
  });
});

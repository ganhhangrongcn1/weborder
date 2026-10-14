/* global it, expect */
import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import usePosPointInputLimit from "../src/features/pos/hooks/usePosPointInputLimit";
import { buildPosLoyaltyBenefit, buildVoucherSelectionKey } from "../src/shared/pos/posLoyalty";

const coupon = { id: "employee", source: "checkout", code: "NHANVIEN", discountType: "percent", value: 20, active: true };
const customer = { loyalty: { totalPoints: 100000 }, loyaltyRule: { maxRedemptionPercent: 30, redeemPointUnit: 1, redeemValue: 1 } };

function setup() {
  let current;
  function Harness({ subtotal = 100000, balance = 100000 }) {
    const [pointsInput, setPointsInput] = useState("");
    const [selectedVoucherId, setSelectedVoucherId] = useState("");
    const benefit = buildPosLoyaltyBenefit({
      subtotal, customer: { ...customer, loyalty: { totalPoints: balance } },
      coupons: [coupon], selectedVoucherId, pointsInput
    });
    usePosPointInputLimit({ usablePoints: benefit.usablePoints, pointSpendStep: benefit.pointSpendStep, setPointsInput });
    current = { pointsInput, setPointsInput, setSelectedVoucherId, benefit, total: subtotal - benefit.voucherDiscount - benefit.pointsDiscount };
    return null;
  }
  let tree;
  act(() => { tree = TestRenderer.create(<Harness />); });
  return { get: () => current, tree, Harness };
}

it("reduces the input and charged points together when NHANVIEN is added after points", () => {
  const { get, tree } = setup();
  act(() => get().setPointsInput("30000"));
  expect(get().benefit.pointsSpent).toBe(30000);
  act(() => get().setSelectedVoucherId(buildVoucherSelectionKey(coupon)));
  expect(get().pointsInput).toBe("20000");
  expect(get().benefit.pointsSpent).toBe(20000);
  expect(get().benefit.voucherDiscount).toBe(20000);
  expect(get().total).toBe(60000);
  act(() => get().setSelectedVoucherId(""));
  expect(get().pointsInput).toBe("20000"); // Never spend more points without the operator choosing it.
  act(() => tree.unmount());
});

it("gives the same result when the voucher is selected before points", () => {
  const { get, tree } = setup();
  act(() => get().setSelectedVoucherId(buildVoucherSelectionKey(coupon)));
  act(() => get().setPointsInput(String(get().benefit.usablePoints)));
  expect(get().pointsInput).toBe("20000");
  expect(get().total).toBe(60000);
  act(() => tree.unmount());
});

it("reconciles the input when items or available balance change", () => {
  const { get, tree, Harness } = setup();
  act(() => get().setPointsInput("30000"));
  act(() => tree.update(<Harness subtotal={50000} />));
  expect(get().pointsInput).toBe("15000");
  act(() => tree.update(<Harness subtotal={50000} balance={4600} />));
  expect(get().pointsInput).toBe("4000");
  act(() => tree.unmount());
});

it("does not interrupt typing each digit while the allowance is unchanged", () => {
  const { get, tree } = setup();
  act(() => get().setPointsInput("2"));
  expect(get().pointsInput).toBe("2");
  act(() => get().setPointsInput("20000"));
  expect(get().benefit.pointsSpent).toBe(20000);
  act(() => tree.unmount());
});

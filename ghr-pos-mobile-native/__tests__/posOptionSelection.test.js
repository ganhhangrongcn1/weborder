/* global describe, it, expect */

import {
  buildInitialPosOptionSelections,
  buildSelectedPosOptionList,
  isPosOptionGroupComplete
} from "../src/shared/pos/posOptionSelection";
import { buildReceiptFooterQrUrl } from "../src/services/pos/posPrinterService";

const exactFullGroup = {
  id: "group-sauce",
  name: "Sốt",
  required: true,
  selectionMode: "exact",
  maxSelect: 3,
  options: [
    { id: "sauce-1", name: "Sốt 1", price: 0 },
    { id: "sauce-2", name: "Sốt 2", price: 2000 },
    { id: "sauce-3", name: "Sốt 3", price: 3000 }
  ]
};

describe("POS option selection rules", () => {
  it("tự chọn toàn bộ khi số chính xác bằng số tùy chọn", () => {
    const selected = buildInitialPosOptionSelections([exactFullGroup], []);

    expect(selected[exactFullGroup.id]).toEqual(["sauce-1", "sauce-2", "sauce-3"]);
    expect(isPosOptionGroupComplete(exactFullGroup, selected[exactFullGroup.id])).toBe(true);
    expect(buildSelectedPosOptionList([exactFullGroup], selected)).toHaveLength(3);
  });

  it("không cho hoàn tất nhóm chính xác khi chưa chọn đủ", () => {
    expect(isPosOptionGroupComplete(exactFullGroup, ["sauce-1", "sauce-2"])).toBe(false);
  });
});
describe("receipt footer QR", () => {
  it("chỉ thêm số điện thoại khi bill có số", () => {
    expect(buildReceiptFooterQrUrl("0901 234 567"))
      .toBe("https://ganhhangrong.vn/orders?phone=0901234567");
    expect(buildReceiptFooterQrUrl(""))
      .toBe("https://ganhhangrong.vn/orders");
  });
});

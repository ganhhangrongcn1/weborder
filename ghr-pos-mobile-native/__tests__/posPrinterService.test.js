/* global describe, it, expect */

import { buildPosCustomerBillText } from "../src/services/pos/posPrinterService";

describe("buildPosCustomerBillText", () => {
  it("tạo bill khách với mã đơn lớn, đường kẻ và các hàng canh hai cột", () => {
    const receipt = buildPosCustomerBillText({
      order: { displayOrderCode: "GHR-1104" },
      cart: [
        {
          name: "Bánh Tráng Cuộn Chấm Sốt Đặc Biệt",
          quantity: 1,
          lineTotal: 30000,
          selectedOptions: [{ name: "Sốt Me Bơ" }],
          note: "Ít cay"
        }
      ],
      totals: {
        subtotal: 30000,
        total: 30000
      },
      branchName: "Gánh Hàng Rong - Đường 30/4",
      cashierName: "Diệp Đường 30/4",
      pagerNumber: "02",
      paymentConfirmed: {
        method: "cash",
        amount: 30000,
        received: 50000,
        change: 20000,
        reference: "CASH-POS-TEST"
      }
    });

    expect(receipt).toContain("@@BIG:GHR-1104");
    expect(receipt).toContain("@@RULE");
    expect(receipt).toContain("@@ROW:1 × Bánh Tráng Cuộn Chấm Sốt Đặc Biệt\t30.000đ");
    expect(receipt).toContain("@@BOLDROW:TỔNG CẦN THU\t30.000đ");
    expect(receipt).toContain("@@ROW:Tiền thối\t20.000đ");
    expect(receipt).not.toMatch(/^-{8,}$/m);
    expect(receipt).not.toContain("Cảm ơn quý khách!");
  });
});

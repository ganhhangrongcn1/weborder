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
    expect(receipt).toContain("@@BOLDROW:ĐÃ THANH TOÁN TIỀN MẶT\t30.000đ");
    expect(receipt).toContain("@@BOLDROW:CÒN PHẢI THU\t0đ");
    expect(receipt).toContain("@@CENTER:*** KHÔNG THU THÊM TIỀN ***");
    expect(receipt).toContain("@@ROW:Tiền thối\t20.000đ");
    expect(receipt).not.toMatch(/^-{8,}$/m);
    expect(receipt).not.toContain("Cảm ơn quý khách!");
  });

  it("in rõ đơn MoMo đã thanh toán và không yêu cầu nhân viên thu thêm", () => {
    const receipt = buildPosCustomerBillText({
      order: { displayOrderCode: "GHR-4080" },
      cart: [{ name: "Mì Trẻ Em Miu Miu", quantity: 1, lineTotal: 4000 }],
      totals: { subtotal: 4000, voucherDiscount: 2000, total: 2000 },
      paymentConfirmed: {
        method: "momo",
        amount: 2000,
        paidAt: "2026-07-23T13:51:00.000Z"
      }
    });

    expect(receipt).toContain("@@BOLDROW:ĐÃ THANH TOÁN VÍ MOMO\t2.000đ");
    expect(receipt).toContain("@@BOLDROW:CÒN PHẢI THU\t0đ");
    expect(receipt).toContain("@@CENTER:*** KHÔNG THU THÊM TIỀN ***");
    expect(receipt).not.toContain("TỔNG CẦN THU");
  });

  it("đơn chưa thanh toán chỉ in phiếu làm món", () => {
    const receipt = buildPosCustomerBillText({
      order: { displayOrderCode: "GHR-4090" },
      cart: [{ name: "Mì Trẻ Em Miu Miu", quantity: 1, lineTotal: 4000 }],
      totals: { subtotal: 4000, total: 4000 },
      paymentConfirmed: null
    });

    expect(receipt).toContain("@@CENTER:PHIẾU LÀM MÓN");
    expect(receipt).toContain("@@CENTER:*** CHƯA THANH TOÁN TẠI QUẦY ***");
    expect(receipt).toContain("1 × Mì Trẻ Em Miu Miu");
    expect(receipt).not.toContain("TỔNG CẦN THU");
    expect(receipt).not.toContain("4.000đ");
  });
});

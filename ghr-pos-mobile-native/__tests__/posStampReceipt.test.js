/* global test, expect */
import { buildStampReceiptSection, placeStampsAfterLoyaltyQr } from "../src/services/pos/posStampReceipt";
const section = buildStampReceiptSection({enabled: true, available: 3});
const footer = "@@RULE\n@@BOLDCENTER:Tích điểm\n@@QR\n@@CENTER:Quét QR\n@@CENTER:Hotline";
test("counter preserves change and notes while moving stamps below QR", () => {
  const result = placeStampsAfterLoyaltyQr(`ĐÃ THANH TOÁN\n${section}\n@@ROW:Tiền thối\t20.000đ\nGhi chú: ít cay`, footer);
  expect(result.text).toContain("Tiền thối\t20.000đ");
  expect(result.text).toContain("Ghi chú: ít cay");
  expect(result.text).not.toContain("@@STAMPS");
  expect(result.footerText.indexOf("@@STAMPS:3")).toBeGreaterThan(result.footerText.indexOf("@@QR"));
  expect(result.footerText.indexOf("@@STAMPS:3")).toBeLessThan(result.footerText.indexOf("Hotline"));
  expect(result.footerText).not.toContain("@@STAMPEND");
});
test("partner keeps one QR with stamps directly below its caption", () => {
  const result = placeStampsAfterLoyaltyQr(`${footer}\nMón ăn\nCảm ơn\n${section}`, "");
  expect(result.text.match(/@@QR/g)).toHaveLength(1);
  expect(result.text.match(/@@STAMPS/g)).toHaveLength(1);
  expect(result.text.indexOf("@@STAMPS:3")).toBeGreaterThan(result.text.indexOf("@@QR"));
  expect(result.text.indexOf("@@STAMPS:3")).toBeLessThan(result.text.indexOf("Món ăn"));
  expect(result.text).not.toContain("@@STAMPEND");
});
test("preparation receipts unchanged", () => {
  expect(placeStampsAfterLoyaltyQr("PHIẾU LÀM MÓN", "")).toEqual({text:"PHIẾU LÀM MÓN",footerText:""});
  expect(buildStampReceiptSection({enabled:false})).toBe("");
});

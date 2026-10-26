export const RECEIPT_SAMPLE_TYPES = [
  { id: "kitchen", label: "Bill món" }, { id: "pos", label: "Khách tại POS" },
  { id: "web", label: "Khách website" }, { id: "partner", label: "Khách đối tác" }
];
export function createReceiptSample(type = "pos", paid = true, hasPhone = true) {
  return {
    id: "", displayOrderCode: type === "partner" ? "GRAB-152" : "GHR-00152",
    source: type === "partner" ? "grabfood" : type === "pos" ? "pos" : "website",
    branchName: "Chi nhánh minh họa", cashierName: type === "pos" ? "Thu ngân minh họa" : "", pagerNumber: type === "partner" ? "" : "12", customerName: "Khách minh họa",
    customerPhone: hasPhone ? "0900000000" : "", createdAt: "2026-10-25T04:30:00+00:00",
    paymentStatus: type === "kitchen" || !paid ? "unpaid" : "paid",
    paymentMethod: type === "partner" ? "Qua ứng dụng đối tác" : type === "web" ? "bank_qr" : "cash",
    subtotal: 80000, promoDiscount: 10000, totalAmount: 70000, expectedEarnPoints: 7000,
    note: "Ít cay, để riêng nước sốt",
    stampSummary: hasPhone ? { enabled: true, available: 3, held: 0 } : null,
    items: [
      { name: "Bánh tráng cuốn", quantity: 2, price: 25000, total: 50000, options: ["Thêm trứng"], note: "Không hành" },
      { name: "Trà tắc", quantity: 2, price: 15000, total: 30000, options: [], note: "Ít đá" }
    ]
  };
}

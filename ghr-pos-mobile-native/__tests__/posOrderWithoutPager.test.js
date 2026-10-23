jest.mock("../src/services/supabase/client", () => ({ supabase: null }));
jest.mock("../src/services/pos/posPrinterService", () => ({ buildPosPreparationBillText: jest.fn() }));
jest.mock("../src/services/pos/posPickupOrderService", () => ({ normalizeWebsiteOrder: jest.fn() }));
jest.mock("../src/services/pos/posStampService", () => ({ invalidatePosStamps: jest.fn(), readPosStamps: jest.fn() }));
jest.mock("../src/services/pos/posCustomerService", () => ({ ensurePosGuestProfile: jest.fn() }));
jest.mock("../src/services/pos/posLoyaltyService", () => ({ applyPosOrderLoyaltyMobile: jest.fn() }));
jest.mock("../src/services/pos/posOfflineOrderQueueService", () => ({ queuePosOfflineOrder: jest.fn(), isLikelyPosNetworkError: jest.fn() }));
import { createPosTakeawayOrderMobile } from "../src/services/pos/posOrderService";
import { queuePosOfflineOrder } from "../src/services/pos/posOfflineOrderQueueService";

const input = { cart: [{ id: "food", name: "Bánh tráng", quantity: 1, price: 19000, note: "Không rau răm" }], totals: { total: 19000 }, branch: { branchUuid: "branch-a" } };
test("disabled branch creates a bill without a pager and keeps the policy and notes for offline replay", async () => {
  const result = await createPosTakeawayOrderMobile({ ...input, pagerEnabled: false, pagerNumber: "02" });
  expect(result.ok).toBe(true);
  expect(result.order.pagerNumber).toBe("");
  expect(result.order.customerName).toBe("Khách tại quầy");
  expect(result.order.items[0].note).toBe("Không rau răm");
  expect(queuePosOfflineOrder.mock.calls[0][0]).toMatchObject({ pagerEnabled: false, pagerNumber: "", cart: input.cart });
});
test("enabled branches and phone ordering still require a pager", async () => {
  expect((await createPosTakeawayOrderMobile(input)).ok).toBe(false);
  expect((await createPosTakeawayOrderMobile({ ...input, phoneOrder: true, pagerEnabled: false })).ok).toBe(false);
  expect((await createPosTakeawayOrderMobile({ ...input, pagerNumber: "03" })).order.pagerNumber).toBe("03");
});

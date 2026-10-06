/* global jest, test, expect, beforeEach */
jest.mock("../src/services/supabase/client", () => ({ supabase: { auth: { getSession: jest.fn() }, rpc: jest.fn() } }));
jest.mock("../src/services/pos/posCustomerService", () => ({ normalizeCustomerPhone: (value) => String(value || "").replace(/^\+?84/, "0") }));
import { supabase } from "../src/services/supabase/client";
import { invalidatePosStamps, readPosStamps, makePosStampGift, withPosStampSummary } from "../src/services/pos/posStampService";
import { buildPosCustomerBillText } from "../src/services/pos/posPrinterService";
beforeEach(() => {
  jest.clearAllMocks(); invalidatePosStamps();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "staff-1" } } } });
  supabase.rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: { enabled: true, available: 10, held: 0 } }) }));
});
test("concurrent phone lookups share one RPC; valid phone normalization and cache", async () => {
  await Promise.all(Array.from({length:20}, () => readPosStamps("+84901234567")));
  await readPosStamps("0901234567");
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).toHaveBeenCalledWith("get_stamp_summary", { p_phone: "0901234567" });
  await readPosStamps("090"); expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
test("changing auth identity cannot reuse staff cache", async () => {
  await readPosStamps("0901234567");
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "staff-2" } } } });
  await readPosStamps("0901234567"); expect(supabase.rpc).toHaveBeenCalledTimes(2);
});
test("receipt uses existing summary with zero extra requests and never awards stamps", async () => {
  const order = { stampSummary: { enabled: true, available: 7, held: 0 } };
  expect(await withPosStampSummary(order, "0901234567")).toBe(order);
  const text = buildPosCustomerBillText({ order, customerPhone:"0901234567", cart:[], totals:{total:0}, paymentConfirmed:{method:"cash",paid:true} });
  expect(text).toContain("@@STAMPS:7"); expect(text).toContain("7/10 tem"); expect(supabase.rpc).not.toHaveBeenCalled();
});
test("lookup failure does not block a receipt", async () => {
  supabase.rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({error:new Error("offline")}) }));
  expect(await withPosStampSummary({id:"saved"}, "0901234567")).toEqual({id:"saved"});
});
test("gift is a single zero-priced basic dish bound to its customer", () => {
  expect(makePosStampGift({id:"gift",price:45000,toppings:[{name:"extra"}]},"+84901234567"))
    .toMatchObject({stampGift:true,stampPhone:"0901234567",quantity:1,price:0,lineTotal:0,toppings:[]});
});

test("print lookup bypasses stale cache after server confirmation, concurrent refreshes share one RPC", async () => {
  await readPosStamps("0901234567");
  await Promise.all(Array.from({length: 5}, () => withPosStampSummary({}, "0901234567", {force: true})));
  expect(supabase.rpc).toHaveBeenCalledTimes(2);
});

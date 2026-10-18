/* global jest, describe, beforeEach, it, expect */
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock("../src/services/supabase/client", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/services/pos/posOrderService", () => ({ createPosTakeawayOrderMobile: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../src/services/supabase/client";
import { createPosTakeawayOrderMobile } from "../src/services/pos/posOrderService";
import { queuePosOfflineOrder, readPosOfflineOrderQueue, removePosOfflineOrder } from "../src/services/pos/posOfflineOrderQueueService";
import { syncPosOfflineOrders } from "../src/services/pos/posOfflineSyncService";

const payload = (id, branchUuid = "branch-a") => ({
  orderIdentity: { orderCode: id }, branch: { branchUuid },
  paidAt: "2026-09-16T06:32:24.402Z", posShiftId: "original-shift"
});
let stored;
let readServer;
beforeEach(() => {
  jest.clearAllMocks();
  stored = "[]";
  AsyncStorage.getItem.mockImplementation(async () => stored);
  AsyncStorage.setItem.mockImplementation(async (_key, value) => { stored = value; });
  readServer = jest.fn().mockResolvedValue({ data: null, error: null });
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: readServer }) }) });
  createPosTakeawayOrderMobile.mockResolvedValue({ ok: true });
});

describe("offline order recovery", () => {
  it("sends only the current branch, preserving order identity, payment time and shift", async () => {
    await queuePosOfflineOrder(payload("A"));
    await queuePosOfflineOrder(payload("B", "branch-b"));
    expect(await syncPosOfflineOrders("branch-a")).toEqual({ synced: 1 });
    expect(createPosTakeawayOrderMobile).toHaveBeenCalledWith({ ...payload("A"), skipOfflineQueue: true });
    expect((await readPosOfflineOrderQueue()).map((entry) => entry.id)).toEqual(["B"]);
  });

  it("shares one sync when manual and automatic triggers overlap", async () => {
    await queuePosOfflineOrder(payload("A"));
    const first = syncPosOfflineOrders("branch-a");
    const second = syncPosOfflineOrders("branch-a");
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(createPosTakeawayOrderMobile).toHaveBeenCalledTimes(1);
  });

  it("retains orders on network failure and retries successfully later", async () => {
    await queuePosOfflineOrder(payload("A"));
    createPosTakeawayOrderMobile.mockResolvedValueOnce({ ok: true, offline: true, message: "offline" });
    expect(await syncPosOfflineOrders("branch-a")).toEqual({ synced: 0 });
    expect((await readPosOfflineOrderQueue())[0].retryCount).toBe(1);
    expect(await syncPosOfflineOrders("branch-a")).toEqual({ synced: 1 });
    expect(await readPosOfflineOrderQueue()).toEqual([]);
  });

  it("does not let an invalid bill block later valid bills", async () => {
    await queuePosOfflineOrder(payload("A"));
    await queuePosOfflineOrder(payload("B"));
    createPosTakeawayOrderMobile.mockResolvedValueOnce({ ok: false, message: "Invalid voucher" });
    expect(await syncPosOfflineOrders("branch-a")).toEqual({ synced: 1 });
    expect((await readPosOfflineOrderQueue()).map((entry) => entry.id)).toEqual(["A"]);
  });

  it.each(["cancelled", "done"])("does not reopen a %s order", async (status) => {
    await queuePosOfflineOrder(payload("A"));
    readServer.mockResolvedValue({ data: { id: "A", status, branch_uuid: "branch-a" } });
    await syncPosOfflineOrders("branch-a");
    expect(createPosTakeawayOrderMobile).not.toHaveBeenCalled();
    expect(await readPosOfflineOrderQueue()).toEqual([]);
  });

  it("stops before writing if the operator signs out during the lookup", async () => {
    await queuePosOfflineOrder(payload("A"));
    let signedIn = true;
    readServer.mockImplementation(async () => { signedIn = false; return { data: null }; });
    await syncPosOfflineOrders("branch-a", () => signedIn);
    expect(createPosTakeawayOrderMobile).not.toHaveBeenCalled();
    expect(await readPosOfflineOrderQueue()).toHaveLength(1);
  });

  it("does not recreate a pending QR after its unpaid session was cancelled", async () => {
    await queuePosOfflineOrder({ ...payload("A"), paymentMeta: { paymentSessionId: "qr-a" } });
    readServer.mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { status: "cancelled", amount_paid: 0 } });
    await syncPosOfflineOrders("branch-a");
    expect(createPosTakeawayOrderMobile).not.toHaveBeenCalled();
    expect(await readPosOfflineOrderQueue()).toEqual([]);
  });

  it("does not lose a newly queued order while deleting a synced entry", async () => {
    await queuePosOfflineOrder(payload("A"));
    await Promise.all([removePosOfflineOrder("A"), queuePosOfflineOrder(payload("B")), queuePosOfflineOrder(payload("C"))]);
    expect((await readPosOfflineOrderQueue()).map((entry) => entry.id)).toEqual(["B", "C"]);
  });

  it("does not overwrite saved orders after a storage read failure", async () => {
    await queuePosOfflineOrder(payload("A"));
    AsyncStorage.getItem.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(queuePosOfflineOrder(payload("B"))).rejects.toThrow("Storage unavailable");
    expect((await readPosOfflineOrderQueue()).map((entry) => entry.id)).toEqual(["A"]);
  });
});

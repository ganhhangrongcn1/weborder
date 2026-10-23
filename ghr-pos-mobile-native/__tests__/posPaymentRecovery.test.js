
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn()
}));

jest.mock("../src/services/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn()
    },
    functions: {
      invoke: jest.fn()
    },
    realtime: {
      setAuth: jest.fn()
    }
  }
}));

import { supabase } from "../src/services/supabase/client";
import { createPosPaymentSession } from "../src/services/pos/posPaymentSessionService";
import { isPosQrSessionReadyForDisplay } from "../src/services/pos/posPaymentService";

const mockGetSession = supabase.auth.getSession;
const mockRefreshSession = supabase.auth.refreshSession;
const mockInvoke = supabase.functions.invoke;
const mockSetRealtimeAuth = supabase.realtime.setAuth;

const buildAuthSession = (token = "token-current", expiresInSeconds = 3600) => ({
  access_token: token,
  expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  user: { id: "user-pos" }
});

const successfulFunctionResponse = {
  data: {
    ok: true,
    session: {
      id: "11111111-1111-4111-8111-111111111111",
      payment_reference: "POS-20260829-TEST",
      status: "pending_payment",
      amount_expected: 30000
    }
  },
  error: null
};

const createInput = {
  requestKey: "pos:sepay:branch:POS-20260829-TEST",
  paymentReference: "POS-20260829-TEST",
  branchUuid: "c0d35bd0-e614-4973-9eb2-17e78fb9a245",
  amountExpected: 30000,
  cart: [{ id: "item-1", quantity: 1 }]
};

describe("POS QR payment recovery", () => {
  test("403 giữ thông báo quyền và không refresh hoặc gửi lại", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {
      message: "Edge Function returned a non-2xx status code",
      context: { status: 403, clone: () => ({ json: async () => ({
        message: "Tài khoản chưa được cấp quyền xác nhận thanh toán QR bằng tay."
      }) }) }
    } });
    const result = await createPosPaymentSession(createInput);
    expect(result.message).toContain("chưa được cấp quyền");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  test("403 không có JSON vẫn báo thiếu quyền", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {
      message: "Forbidden", context: { status: 403 }
    } });
    const result = await createPosPaymentSession(createInput);
    expect(result.message).toContain("không có quyền");
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  test("409 phiên QR hết hạn không bị coi là hết phiên đăng nhập", async () => {
    mockInvoke.mockResolvedValue({ data: { message: "Phiên QR đã hết hạn." },
      error: { context: { status: 409 }, message: "Conflict" } });
    const result = await createPosPaymentSession(createInput);
    expect(result.message).toBe("Phiên QR đã hết hạn.");
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
    mockInvoke.mockReset();
    mockSetRealtimeAuth.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: buildAuthSession() },
      error: null
    });
    mockInvoke.mockResolvedValue(successfulFunctionResponse);
  });

  test("không cho hiển thị QR nếu chưa có phiên hợp lệ", () => {
    expect(isPosQrSessionReadyForDisplay(null)).toBe(false);
    expect(isPosQrSessionReadyForDisplay({
      paymentReference: "POS-20260829-TEST",
      status: "pending_payment"
    })).toBe(false);
    expect(isPosQrSessionReadyForDisplay({
      id: "session-1",
      paymentReference: "POS-20260829-TEST",
      status: "failed"
    })).toBe(false);
    expect(isPosQrSessionReadyForDisplay({
      id: "session-1",
      paymentReference: "POS-20260829-TEST",
      status: "pending_payment"
    })).toBe(true);
  });

  test("tự làm mới token sắp hết hạn trước khi tạo phiên", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: buildAuthSession("token-old", 30) },
      error: null
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: buildAuthSession("token-fresh") },
      error: null
    });

    const result = await createPosPaymentSession(createInput);

    expect(result.ok).toBe(true);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockSetRealtimeAuth).toHaveBeenCalledWith("token-fresh");
    expect(mockInvoke).toHaveBeenCalledWith(
      "pos-payment-session-api",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-fresh" }
      })
    );
  });

  test("gặp JWT hết hạn thì refresh và gửi lại đúng một lần", async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: buildAuthSession("token-recovered") },
      error: null
    });
    mockInvoke
      .mockResolvedValueOnce({
        data: { message: "JWT expired" },
        error: { message: "JWT expired", context: { status: 401 } }
      })
      .mockResolvedValueOnce(successfulFunctionResponse);

    const result = await createPosPaymentSession(createInput);

    expect(result.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke.mock.calls[0][1].body).toEqual(mockInvoke.mock.calls[1][1].body);
    expect(mockInvoke.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer token-recovered" });
  });

  test("mất kết nối tạm thời thì thử lại cùng request key", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Failed to fetch", context: { status: 0 } }
      })
      .mockResolvedValueOnce(successfulFunctionResponse);

    const result = await createPosPaymentSession(createInput);

    expect(result.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke.mock.calls[0][1].body.session.request_key)
      .toBe(mockInvoke.mock.calls[1][1].body.session.request_key);
  });

  test("không gọi dịch vụ nếu refresh token thất bại", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: buildAuthSession("token-old", 10) },
      error: null
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid refresh token" }
    });

    const result = await createPosPaymentSession(createInput);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("đăng nhập lại");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

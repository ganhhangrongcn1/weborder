/* global describe, test, expect, jest */

jest.mock("../src/services/supabase/client", () => ({ supabase: null }));

import { isValidVietnamMobilePhone } from "../src/services/pos/posCustomerService";

describe("isValidVietnamMobilePhone", () => {
  test.each([
    "0321234567",
    "0551234567",
    "0701234567",
    "0871234567",
    "0911234567"
  ])("chấp nhận đầu số di động Việt Nam hợp lệ: %s", (phone) => {
    expect(isValidVietnamMobilePhone(phone)).toBe(true);
  });

  test.each([
    "21758",
    "0123456789",
    "0951234567",
    "091123456",
    "09112345678"
  ])("từ chối số điện thoại không hợp lệ: %s", (phone) => {
    expect(isValidVietnamMobilePhone(phone)).toBe(false);
  });
});

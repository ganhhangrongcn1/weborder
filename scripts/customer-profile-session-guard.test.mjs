import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../src/services/supabaseAuthService.js", import.meta.url), "utf8");
const start = source.indexOf("export async function syncCustomerProfileToSupabase(");
const end = source.indexOf("export async function logoutCustomerAuthSession", start);
assert.ok(start >= 0 && end > start);

async function run(authResult) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => authResult,
      updateUser: async () => { calls.push("auth-update"); return { error: null }; }
    },
    rpc: async (name) => { calls.push(name); return { error: null }; }
  };
  const context = vm.createContext({
    getClientReady: async () => client,
    getCustomerKey: (phone) => phone,
    isSupabaseRuntimeWriteEnabled: () => true,
    normalizeAuthError: (_error, fallback) => fallback,
    console
  });
  vm.runInContext(source.slice(start, end).replace("export async", "async"), context);
  const result = await context.syncCustomerProfileToSupabase({
    phone: "test-phone", name: "Khách thử", authUserId: "cached-user"
  });
  return { result, calls };
}

test("mã người dùng lưu cũ không thay thế phiên đăng nhập hợp lệ", async () => {
  const { result, calls } = await run({ data: { user: null }, error: null });
  assert.equal(result.ok, false);
  assert.match(result.message, /đăng nhập lại/);
  assert.deepEqual(calls, []);
});

test("lỗi xác thực chặn RPC và cập nhật auth kể cả có dữ liệu user", async () => {
  const { result, calls } = await run({ data: { user: { id: "user" } }, error: { message: "expired" } });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, []);
});

test("phiên hợp lệ vẫn đồng bộ hồ sơ và thông tin auth", async () => {
  const { result, calls } = await run({ data: { user: { id: "user" } }, error: null });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["sync_own_customer_profile", "auth-update"]);
});

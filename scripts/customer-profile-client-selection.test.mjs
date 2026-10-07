import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../src/services/repositories/coreSupabaseRepository.js", import.meta.url), "utf8");
function functionSource(name, next) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(next, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
const code = functionSource("hasSupabaseAuthSession", "function normalizePhone(")
  + functionSource("writeProfileRowToTable", "function toAddressRow(");

async function run(customerSession, runtimeSession, rpcError = null, logoutAfterSelection = false, authError = null) {
  const calls = [];
  function client(scope, session) {
    return {
      auth: {
        getSession: async () => ({ data: { session } }),
        getUser: async () => ({ data: { user: session && !logoutAfterSelection ? { id: scope } : null }, error: authError })
      },
      rpc: async () => { calls.push(scope); return { error: rpcError }; }
    };
  }
  const customer = client("customer", customerSession);
  const runtime = client("runtime", runtimeSession);
  const context = vm.createContext({
    isSupabaseReady: () => true,
    getCustomerSupabaseClientAsync: async () => customer,
    getSupabaseClientAsync: async () => runtime,
    toCustomerRow: (user) => ({ phone: user.phone, name: user.name, avatar_url: "" })
  });
  vm.runInContext(code, context);
  const operation = context.writeProfileRowToTable({ phone: "test", name: "Khách thử" });
  return { operation, calls };
}

test("ưu tiên phiên khách hàng khi phiên runtime chưa đăng nhập", async () => {
  const { operation, calls } = await run({ access_token: "test" }, null);
  await operation;
  assert.deepEqual(calls, ["customer"]);
});

test("giữ fallback runtime khi chỉ runtime có phiên", async () => {
  const { operation, calls } = await run(null, { access_token: "test" });
  await operation;
  assert.deepEqual(calls, ["runtime"]);
});

test("không có phiên thì báo thất bại và không gọi RPC", async () => {
  const { operation, calls } = await run(null, null);
  await assert.rejects(operation, (error) => error.code === "42501" && /đăng nhập lại/.test(error.message));
  assert.deepEqual(calls, []);
});

test("không che lỗi quyền sở hữu do Supabase trả về", async () => {
  const expected = { code: "42501", message: "customer_profile_claim_denied" };
  const { operation } = await run({ access_token: "test" }, null, expected);
  await assert.rejects(operation, (error) => error === expected);
});

test("đăng xuất sau khi chọn client thì chặn ghi tại kiểm tra kế tiếp", async () => {
  const { operation, calls } = await run({ access_token: "test" }, null, null, true);
  await assert.rejects(operation, (error) => error.code === "42501");
  assert.deepEqual(calls, []);
});

test("hai phiên cùng tồn tại vẫn chọn customer", async () => {
  const { operation, calls } = await run({ access_token: "customer" }, { access_token: "runtime" });
  await operation;
  assert.deepEqual(calls, ["customer"]);
});

test("customer xác thực lỗi không thử ghi bằng runtime và giữ lỗi gốc", async () => {
  const expected = { message: "network auth failure" };
  const { operation, calls } = await run({ access_token: "customer" }, { access_token: "runtime" }, null, false, expected);
  await assert.rejects(operation, (error) => error === expected);
  assert.deepEqual(calls, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/services/customerOrderCountingRpcService.js", import.meta.url), "utf8");
const snippet = source.slice(source.indexOf("function isMissingRpcError("), source.indexOf("function isRpcTemporarilyUnavailable("));
const classify = vm.runInNewContext(`const RPC_MISSING_CODES = new Set(['42883','PGRST202']); ${snippet}; isMissingRpcError`, {
  toText: (value) => String(value || "").trim()
});
const rpc = "get_customer_order_count_summary";

test("missing exact target function permits temporary unavailable cache", () => {
  assert.equal(classify({ code: "42883", message: `function public.${rpc}(text) does not exist` }, rpc), true);
  assert.equal(classify({ code: "PGRST202", message: `Could not find the function public.${rpc}(p_phone) in the schema cache` }, rpc), true);
});

test("column, relation and permission errors never disable the RPC", () => {
  for (const error of [
    { code: "42703", message: 'column missing_column does not exist' },
    { code: "42P01", message: 'relation public.missing_table does not exist' },
    { code: "42501", message: 'permission denied for table profiles' },
    { code: "57014", message: 'canceling statement due to statement timeout' }
  ]) assert.equal(classify(error, rpc), false);
});

test("missing nested function or prefix match is not missing the requested RPC", () => {
  assert.equal(classify({ code: "42883", message: 'function public.normalize_missing_phone(text) does not exist' }, rpc), false);
  assert.equal(classify({ code: "PGRST202", message: `Could not find the function public.${rpc}_v2(text)` }, rpc), false);
});

test("bare code and unrelated message cannot disable a deployed RPC", () => {
  assert.equal(classify({ code: "42883" }, rpc), false);
  assert.equal(classify({ message: `permission denied for function public.${rpc}(text)` }, rpc), false);
  assert.equal(classify(null, rpc), false);
  assert.equal(classify({ message: `Could not find the function public.${rpc}(text)` }, rpc), false);
});

test("non-target errors leave the next RPC attempt enabled; exact missing expires in five minutes", () => {
  let now = 1000;
  const cacheCode = source.slice(source.indexOf("function isMissingRpcError("), source.indexOf("async function getClientReady("));
  const api = vm.runInNewContext(`const RPC_MISSING_CODES = new Set(['42883','PGRST202']); const RPC_UNAVAILABLE_TTL_MS = 300000; const unavailableRpcCache = new Map(); ${cacheCode}; ({markRpcTemporarilyUnavailable, isRpcTemporarilyUnavailable})`, {
    toText: (value) => String(value || "").trim(), Date: { now: () => now }
  });
  api.markRpcTemporarilyUnavailable(rpc, { code: "42703", message: 'column missing_column does not exist' });
  assert.equal(api.isRpcTemporarilyUnavailable(rpc), false);
  api.markRpcTemporarilyUnavailable(rpc, { code: "42883", message: `function public.${rpc}(text) does not exist` });
  assert.equal(api.isRpcTemporarilyUnavailable(rpc), true);
  assert.equal(api.isRpcTemporarilyUnavailable("get_monthly_customer_gift_stats_by_phones"), false);
  now += 300001;
  assert.equal(api.isRpcTemporarilyUnavailable(rpc), false);
});

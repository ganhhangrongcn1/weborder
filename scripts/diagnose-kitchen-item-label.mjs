// Read-only reproduction: real formatters, mocked database and printer bridge.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const printed = [];
const context = vm.createContext({ console, Date, Map, Set, Promise, setTimeout, clearTimeout });
function mock(values) {
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
}
async function load(path, deps = {}, suffix = "", revision = "") {
  const source = revision
    ? execFileSync("git", ["show", `${revision}:${path}`], { encoding: "utf8", cwd: root })
    : fs.readFileSync(new URL(path, root), "utf8");
  const module = new vm.SourceTextModule(source + suffix, { context });
  await module.link((name) => {
    assert(deps[name], `Missing mock: ${name}`);
    return deps[name];
  });
  await module.evaluate();
  return module;
}
const compact = await load("ghr-pos-mobile-native/src/services/pos/compactReceiptLayout.js");
const template = await load("ghr-pos-mobile-native/src/services/pos/receiptTemplate.js", { "./compactReceiptLayout.js": compact });
const stamps = await load("ghr-pos-mobile-native/src/services/pos/posStampReceipt.js");
const native = await load("ghr-pos-mobile-native/src/services/pos/posPrinterService.js", {
  "./receiptTemplate": template,
  "./posReceiptTemplateService": mock({ loadPosReceiptTemplate: async () => ({ enabled: true }) }),
  "./posStampReceipt": stamps,
  "react-native": mock({ Platform: { OS: "android" }, NativeModules: { PosPrinter: { printReceipt: async (payload) => printed.push(payload) } } }),
  "./posCashBreakdownService": mock({ getCashBreakdownEntries: () => [] }),
  "../../utils/format": mock({ formatMoney: (value) => Number(value).toLocaleString("vi-VN") + "đ" })
});
const web = await load("src/services/printerService.js", {
  "./stampReceiptService.js": mock({ default: () => "" }),
  "./stampProgramService.js": mock({ readStampSummary: async () => ({}) }),
  "./receiptLoyaltyService.js": mock({ prepareReceiptLoyaltyUrl: async () => "" }),
  "./receiptTemplateService.js": mock({ getReceiptTemplate: () => ({}), loadReceiptTemplate: async () => ({}) }),
  "../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js": template,
  "./receiptTemplateHtml.js": mock({ default: () => "" })
});
const capturedRows = [];
const client = { from(table) {
  assert.equal(table, "print_jobs");
  return { insert(rows) {
    capturedRows.push(...rows);
    return { select: async () => ({ data: rows, error: null }) };
  } };
} };
const jobs = await load("src/services/printJobService.js", {
  "./printerService.js": web,
  "./supabase/supabaseRuntimeClient.js": mock({
    ensureSupabaseRealtimeReady: async () => true,
    getSupabaseAdminAuthClient: () => client, getSupabaseKitchenAuthClient: () => null,
    getSupabaseRuntimeClient: () => null, initSupabaseAdminAuthClient: async () => null,
    initSupabaseKitchenAuthClient: async () => null, initSupabaseRuntimeClient: async () => null
  }),
  "./posCashBreakdownService.js": mock({ getCashBreakdownEntries: () => [], normalizeCashBreakdown: () => ({}) })
});
const stationDependencies = {
  "./posStampReceipt": stamps,
  "./posStampService": mock({ withPosStampSummary: async (order) => order }),
  "./posOrderAlertService": mock({ isWebsiteOrderPaid: () => true, playPosOrderAlert: async () => false }),
  "react-native": mock({ AppState: { currentState: "active" } }),
  "../supabase/client": mock({ supabase: null }),
  "./posPrinterService": native
};
const station = await load("ghr-pos-mobile-native/src/services/pos/posPrintStationService.js", stationDependencies,
  "\nexport { isPosOrderPrintJob };\n");
const legacyStation = await load("ghr-pos-mobile-native/src/services/pos/posPrintStationService.js", stationDependencies,
  "\nexport { isPosOrderPrintJob };\n", "8d89f40");
// Cloud ghr_app_downloads 0.4.32/63 SHA-256 matches the artifact built at this commit.
const releasedStation = await load("ghr-pos-mobile-native/src/services/pos/posPrintStationService.js", stationDependencies,
  "\nexport { isPosOrderPrintJob };\n", "848574fe5c20df1ff19ae1324ef6661491900229");

const results = [];
for (const source of ["website", "grabfood", "shopeefood", "xanhngon", "pos_mobile", "pos"]) {
 for (const receiptWidthMm of [58, 80]) {
  const order = {
    id: "sample-order", orderCode: source.startsWith("pos") ? "POS-20261029-120001" : "GHR-TEST", platform: source, source,
    branchUuid: "sample-branch", orderNote: "Để riêng nước sốt",
    customerName: "Khách mẫu", customerPhone: "", totalAmount: 65000,
    paymentStatus: "paid", items: [
      { name: "Bánh tráng cuốn bơ", quantity: 2, note: "Ít cay", price: 20000,
        selectedOptions: [{ name: "Thêm trứng cút" }] },
      { name: "Trà tắc", quantity: 1, price: 25000 }
    ]
  };
  capturedRows.length = 0;
  const result = await jobs.namespace.createItemLabelPrintJobs(order, [
    { itemIndex: 0, unitIndex: 0 }, { itemIndex: 0, unitIndex: 0 }, { itemIndex: 0, unitIndex: 1 }
  ], { branchUuid: "sample-branch", printerOptions: { receiptWidthMm } });
  assert.equal(result.ok, true);
  assert.equal(result.count, 2, "One job per selected unit; duplicate selections are removed");
  for (const job of capturedRows) {
   const payload = job.payload;
  assert.equal(payload.order.items.length, 1);
  assert.equal(payload.order.items[0].quantity, 1);
  assert.deepEqual(Object.keys(payload.order).sort(), ["items", "orderCode"]);
  assert(!payload.text.includes("Trà tắc"), "Kitchen label excludes unselected item");
  assert(!payload.text.includes("HÓA ĐƠN"), "Kitchen creates a compact label");
  assert(payload.text.includes("Thêm trứng cút"));
  assert(payload.text.includes("Ít cay"));
  assert(payload.text.includes("Để riêng nước sốt"));
  assert(payload.text.includes(`Phần ${payload.label.unitNumber}/2`));
  assert(payload.html.includes("Thêm trứng cút") && !payload.html.includes("Trà tắc"));
  assert(job.order_code.startsWith("TEM-"));
  for (const [version, consumer] of [["current", station], ["0.4.32", releasedStation], ["0.4.31", legacyStation]]) {
  const outgoing = consumer.namespace.buildPrintPayload(job);
  const skippedAsPosBill = consumer.namespace.isPosOrderPrintJob(job);
  await native.namespace.printLocalReceipt(outgoing);
  const bridge = printed.at(-1);
  const observation = {
    source, version, receiptWidthMm, labelPreserved: outgoing.text === payload.text,
    sourceType: outgoing.sourceType, fullBillHeading: bridge.text.includes("HÓA ĐƠN"),
    rewardFooter: Boolean(bridge.footerText || bridge.footerQrUrl),
    unselectedItemPrinted: bridge.text.includes("Trà tắc"), skippedAsPosBill
  };
  assert.equal(observation.labelPreserved, true, "Consumer must preserve the label exactly");
  assert.equal(observation.sourceType, "item_label");
  assert.equal(observation.fullBillHeading, false);
  assert.equal(observation.rewardFooter, false);
  assert.equal(observation.unselectedItemPrinted, false);
  assert.equal(observation.skippedAsPosBill, false);
  assert.equal(bridge.text, payload.text);
  assert(!bridge.text.includes("Khách mẫu") && !bridge.text.includes("65.000"));
  results.push(observation);
  }
  }
 }
}
const beforeInvalid = capturedRows.length;
assert.equal((await jobs.namespace.createItemLabelPrintJobs({ branchUuid: "other" }, [], { branchUuid: "sample-branch" })).ok, false);
assert.equal((await jobs.namespace.createItemLabelPrintJobs({ branchUuid: "sample-branch", items: [{ quantity: 1 }] }, [{ itemIndex: 0, unitIndex: 1 }])).ok, false);
assert.equal((await jobs.namespace.createItemLabelPrintJobs({ branchUuid: "sample-branch", items: [] }, [])).ok, false);
assert.equal(capturedRows.length, beforeInvalid, "Invalid selections do not enqueue jobs");
for (const item of [{ name: "Món không ghi chú" }, { name: "Món", note: "Không hành", toppings: [{ label: "Thêm bơ" }] }]) {
  const payload = web.namespace.buildItemLabelPrintPayload({ orderCode: "GHR-NOTE" }, item);
  assert(!payload.text.includes("Ghi chú:") || payload.text.includes("Không hành"));
  if (item.toppings) assert(payload.text.includes("Thêm bơ"));
}
console.log(JSON.stringify({ printer: "mock only; no physical print or database access",
  passedPrintPaths: results.length, sources: 6, consumerVersions: ["current", "0.4.32", "0.4.31"], widths: [58, 80],
  selectionChecks: "deduplication, separate units, invalid/empty selection, branch scope, toppings, notes, no customer/financial/footer data" }, null, 2));

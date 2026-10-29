// Use the recorded fixture, or --stdin for a fresh Cloud configuration snapshot.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildKitchenChecklistOptionKeys, getKitchenRecipeOptions,
  normalizeKitchenOptionMatchText } from "../src/features/kitchen/kitchenOptionDisplay.js";

const input = JSON.parse(fs.readFileSync(process.argv.includes("--stdin") ? 0
  : new URL("./fixtures/xanhngon-grab-checklist.json", import.meta.url), "utf8"));
const context = vm.createContext({ console });
const mocks = {
  "./repositories/adminConfigRepository.js": { adminConfigRepository: {} },
  "./supabase/adminSupabaseClient.js": { getAdminSupabaseClient: () => null },
  "./optionGroupService.js": { loadOptionGroupPresetsAsync: async () => [] }
};
const service = new vm.SourceTextModule(fs.readFileSync(new URL(
  "../src/services/kitchenOptionGroupSettingsService.js", import.meta.url), "utf8"), { context });
await service.link((name) => {
  const values = mocks[name];
  assert(values, `Unexpected dependency ${name}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
});
await service.evaluate();
const build = (options, config) => service.namespace.buildKitchenChecklistOptions(
  [options, options.map((option) => option.name)], "xanhngon", config);
let referenceChecks = 0;
for (const setting of input.after.groups) {
  const references = input.grab.filter((ref) => ref.optionName === setting.optionName);
  assert(references.length, `Missing Grab reference: ${setting.optionName}`);
  assert(references.every((ref) => ref.enabled === setting.enabled), `Ambiguous enabled state: ${setting.optionName}`);
  const raw = [{ option_name: "Tùy chọn", option_item: setting.optionName, name: setting.optionName }];
  const result = build(raw, input.after);
  assert.equal(result.length, setting.enabled ? 1 : 0, setting.optionName);
  if (setting.enabled) {
    const keys = buildKitchenChecklistOptionKeys(result);
    assert(keys.has(normalizeKitchenOptionMatchText(setting.optionName)), "Checklist hides its duplicate display chip");
    assert.equal(result[0].value, setting.optionName);
  }
  referenceChecks++;
}
for (const item of input.cases) {
  const oldResult = build(item.options, input.before);
  const nextResult = build(item.options, input.after);
  if (item.code === "XN-6974" && item.name === "Combo Cuốn Trộn Chấm") {
    assert.equal(oldResult.length, 1);
    assert.equal(nextResult.length, 3);
    for (const name of ["Bánh Tráng Cuốn Bơ", "Bánh Tráng Trộn Đặc Biệt", "Bánh Tráng Chấm Gánh"]) {
      assert(nextResult.some((option) => option.value === name));
    }
  }
  if (item.code === "XN-4677" && item.name === "Bánh Tráng Cuốn Bơ") {
    assert.equal(oldResult.length, 0);
    assert.equal(nextResult.length, 1);
    assert.equal(nextResult[0].value, "Trà Xoài Chanh Dây - Size L");
  }
  if (!item.options.length) assert.equal(nextResult.length, 0);
}
for (const name of ["Không Cay", "Hơi Cay Cay", "Cay Sấp Mặt", "Trộn Đều Topping",
  "Trộn Đều Topping Bóp Trứng", "Sốt Muối Béo", "Sốt Bơ Bò", "Sốt Sate Bò"]) {
  assert.equal(build([{ option_name: "Tùy chọn", name }], input.after).length, 0, name);
  assert(getKitchenRecipeOptions([name]).some((option) => option.label === name), "Instructions remain visible");
}
console.log(JSON.stringify({ referenceChecks, realOrderItems: input.cases.length,
  preservedInstructions: 8, mode: "read-only; mocked database and printer" }, null, 2));

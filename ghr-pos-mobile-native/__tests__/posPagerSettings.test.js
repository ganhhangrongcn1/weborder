jest.mock("../src/services/supabase/client", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from "../src/services/supabase/client";
import { readPosPagerEnabled, savePosPagerEnabled } from "../src/services/pos/posPagerSettingsService";

beforeEach(() => jest.clearAllMocks());
test("each branch uses its own setting and an unset branch keeps pagers enabled", async () => {
  const eq = jest.fn((_column, key) => ({ maybeSingle: async () => ({ data: key.endsWith("branch-a") ? { value: { enabled: false } } : null }) }));
  supabase.from.mockReturnValue({ select: () => ({ eq }) });
  expect(await readPosPagerEnabled("branch-a")).toBe(false);
  expect(await readPosPagerEnabled("branch-b")).toBe(true);
  expect(eq).toHaveBeenCalledWith("id", "ghr_pos_pager_branch-a");
  expect(eq).toHaveBeenCalledWith("id", "ghr_pos_pager_branch-b");
});
test("saving uses the scoped RPC and reports permission or network failures", async () => {
  supabase.rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error("Không có quyền") });
  await savePosPagerEnabled("branch-a", false);
  expect(supabase.rpc).toHaveBeenCalledWith("set_pos_branch_pager_enabled", { p_branch_uuid: "branch-a", p_enabled: false });
  await expect(savePosPagerEnabled("branch-b", false)).rejects.toThrow("Không có quyền");
});

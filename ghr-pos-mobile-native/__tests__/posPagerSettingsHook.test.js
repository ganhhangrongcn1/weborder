import React from "react";
import renderer, { act } from "react-test-renderer";
import usePosPagerSettings from "../src/features/pos/hooks/usePosPagerSettings";
import { readPosPagerEnabled, savePosPagerEnabled } from "../src/services/pos/posPagerSettingsService";
jest.mock("../src/services/pos/posPagerSettingsService", () => ({ readPosPagerEnabled: jest.fn(), savePosPagerEnabled: jest.fn() }));
jest.useRealTimers();
beforeEach(() => { jest.clearAllMocks(); savePosPagerEnabled.mockResolvedValue(); });

test("branch account settings survive device remount; another branch keeps its own setting", async () => {
  readPosPagerEnabled.mockImplementation(async branch => branch !== "branch-a");
  let value;
  const props = { branchUuid: "branch-a", phoneMode: false, locked: false, onMessage: jest.fn(), onClearPager: jest.fn() };
  function Harness(input) { value = usePosPagerSettings(input); return null; }
  let tree;
  await act(async () => { tree = renderer.create(<Harness {...props} />); });
  expect(value.pagerEnabled).toBe(false);
  act(() => tree.unmount());
  await act(async () => { tree = renderer.create(<Harness {...props} />); });
  expect(value.pagerEnabled).toBe(false);
  await act(async () => { tree.update(<Harness {...props} branchUuid="branch-b" />); });
  expect(value.pagerEnabled).toBe(true);
  await act(async () => { await value.changePagerEnabled(false); });
  expect(savePosPagerEnabled).toHaveBeenCalledWith("branch-b", false);
  expect(value.pagerEnabled).toBe(false);
  expect(props.onClearPager).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test("checkout locks settings and failed saves preserve the current branch policy", async () => {
  readPosPagerEnabled.mockResolvedValue(true);
  let value;
  function Harness(props) { value = usePosPagerSettings(props); return null; }
  const props = { branchUuid: "branch-a", phoneMode: false, locked: false, onMessage: jest.fn(), onClearPager: jest.fn() };
  let tree;
  await act(async () => { tree = renderer.create(<Harness {...props} />); });
  act(() => { tree.update(<Harness {...props} locked />); });
  await act(async () => { expect(await value.changePagerEnabled(false)).toBe(false); });
  expect(savePosPagerEnabled).not.toHaveBeenCalled();
  await act(async () => { tree.update(<Harness {...props} />); });
  savePosPagerEnabled.mockRejectedValue(new Error("Mất kết nối"));
  await act(async () => { expect(await value.changePagerEnabled(false)).toBe(false); });
  expect(value.pagerEnabled).toBe(true);
  expect(props.onMessage).toHaveBeenCalledWith("Mất kết nối");
  expect(props.onClearPager).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

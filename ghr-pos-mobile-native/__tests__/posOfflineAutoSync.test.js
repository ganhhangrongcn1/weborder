import React from "react";
import { AppState } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import usePosOfflineAutoSync from "../src/features/pos/hooks/usePosOfflineAutoSync";

function Harness(props) {
  usePosOfflineAutoSync(props);
  return null;
}

let listener;
let remove;
let tree;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  AppState.currentState = "active";
  remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
    listener = callback;
    return { remove };
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("retries after connectivity can return, pauses in background, and resumes immediately", () => {
  const sync = jest.fn().mockResolvedValue({ ok: false });
  act(() => { tree = TestRenderer.create(<Harness enabled sync={sync} />); });
  expect(sync).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(15000));
  expect(sync).toHaveBeenCalledTimes(2);
  AppState.currentState = "background";
  act(() => jest.advanceTimersByTime(30000));
  expect(sync).toHaveBeenCalledTimes(2);
  AppState.currentState = "active";
  act(() => listener("active"));
  expect(sync).toHaveBeenCalledTimes(3);
  expect(sync).toHaveBeenLastCalledWith({ silent: true, onlyWhenQueued: true });
  act(() => tree.update(<Harness enabled={false} sync={sync} />));
  act(() => jest.advanceTimersByTime(30000));
  expect(sync).toHaveBeenCalledTimes(3);
  expect(remove).toHaveBeenCalledTimes(1);
});

it("uses the latest operator callback without creating extra timers", () => {
  const first = jest.fn();
  const next = jest.fn();
  act(() => { tree = TestRenderer.create(<Harness enabled sync={first} />); });
  act(() => tree.update(<Harness enabled sync={next} />));
  act(() => jest.advanceTimersByTime(15000));
  expect(first).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(1);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
});

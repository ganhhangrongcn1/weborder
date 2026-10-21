/* global jest, test, expect, beforeEach, afterEach */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import usePosWebsiteOrderSync from '../src/features/pos/hooks/usePosWebsiteOrderSync';
import { getPosWebsiteOrders, subscribePosWebsiteOrderChanges } from '../src/services/pos/posPickupOrderService';
jest.mock('../src/services/pos/posPickupOrderService', () => ({ getPosWebsiteOrders: jest.fn(), subscribePosWebsiteOrderChanges: jest.fn() }));
let event, props, tree, refresh;
const flush = async () => { await act(async () => { for (let i=0;i<8;i++) await Promise.resolve(); }); };
function Harness(p) { refresh=usePosWebsiteOrderSync(p); return null; }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  AppState.currentState='active';
  jest.spyOn(AppState,'addEventListener').mockImplementation(() => ({remove:jest.fn()}));
  subscribePosWebsiteOrderChanges.mockImplementation((branch, callback) => { event=callback; return jest.fn(); });
  getPosWebsiteOrders.mockResolvedValue({pickupOrders:[{id:'new'}],deliveryOrders:[]});
  props={branchUuid:'branch',userId:'staff',setPickupOrders:jest.fn(),setDeliveryOrders:jest.fn(),setLoading:jest.fn(),setError:jest.fn()};
});
afterEach(() => { if(tree) act(() => tree.unmount()); tree=null; jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
const mount=async () => { act(() => { tree=renderer.create(<Harness {...props}/>); }); await flush(); };
test('website queue loads independently and polls every five seconds in foreground', async () => {
  await mount(); expect(props.setPickupOrders).toHaveBeenCalledWith([{id:'new'}]);
  act(() => jest.advanceTimersByTime(5000)); await flush(); expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
  AppState.currentState='background'; act(() => jest.advanceTimersByTime(10000)); await flush(); expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
});
test('an event received during a read queues one follow-up rather than disappearing', async () => {
  let finish; getPosWebsiteOrders.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
  await mount();
  act(() => { event(); jest.advanceTimersByTime(150); event(); jest.advanceTimersByTime(150); });
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(1);
  await act(async () => finish({pickupOrders:[{id:'old'}],deliveryOrders:[]})); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2); expect(props.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
});
test('errors retain the existing list and a later refresh clears the error', async () => {
  await mount(); props.setPickupOrders.mockClear(); getPosWebsiteOrders.mockRejectedValueOnce(new Error('offline'));
  await act(async () => refresh()); expect(props.setPickupOrders).not.toHaveBeenCalled(); expect(props.setError).toHaveBeenLastCalledWith('offline');
  await act(async () => refresh()); expect(props.setError).toHaveBeenLastCalledWith('');
});
test('late results from a different branch cannot overwrite the current branch', async () => {
  let finish; getPosWebsiteOrders.mockImplementationOnce(() => new Promise(resolve => { finish=resolve; }));
  await mount(); act(() => tree.update(<Harness {...props} branchUuid="branch-2"/>)); await flush();
  props.setPickupOrders.mockClear(); await act(async () => finish({pickupOrders:[{id:'wrong'}],deliveryOrders:[]})); await flush();
  expect(props.setPickupOrders).not.toHaveBeenCalled();
});

test('a request that never responds must time out visibly and allow queued updates to recover', async () => {
  let finishOld;
  getPosWebsiteOrders.mockImplementationOnce(() => new Promise(resolve => { finishOld=resolve; }));
  await mount();
  // The old device keeps waiting while another request with the same account can succeed.
  act(() => jest.advanceTimersByTime(11000)); await flush();
  expect(props.setLoading).toHaveBeenLastCalledWith(false);
  expect(props.setError).toHaveBeenCalledWith(expect.stringContaining("10 giây"));
  expect(getPosWebsiteOrders.mock.calls[0][0].signal.aborted).toBe(true);
  expect(getPosWebsiteOrders.mock.calls.length).toBeGreaterThan(1);
  expect(props.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
  props.setPickupOrders.mockClear();
  await act(async () => finishOld({pickupOrders:[{id:'stale'}],deliveryOrders:[]})); await flush();
  expect(props.setPickupOrders).not.toHaveBeenCalled();
});

test('returning to foreground reloads immediately without waiting for the five-second poll', async () => {
  let listener;
  AppState.addEventListener.mockImplementation((name, callback) => { listener=callback; return {remove:jest.fn()}; });
  try {
    await mount();
    AppState.currentState='background'; act(() => listener('background'));
    act(() => jest.advanceTimersByTime(30000)); await flush();
    expect(getPosWebsiteOrders).toHaveBeenCalledTimes(1);
    AppState.currentState='active'; act(() => listener('active')); await flush();
    expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
  } finally { /* Listener cleanup is verified by afterEach unmount. */ }
});

test('background realtime bursts do not read orders and foreground catches up once', async () => {
  let listener;
  AppState.addEventListener.mockImplementation((name, callback) => { listener=callback; return {remove:jest.fn()}; });
  await mount();
  AppState.currentState='background'; act(() => listener('background'));
  act(() => {
    for (let i=0;i<20;i++) { event({eventType:'UPDATE'}); jest.advanceTimersByTime(200); }
    event({eventType:'SYNC'}); jest.advanceTimersByTime(150);
  });
  await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(1);
  AppState.currentState='active'; act(() => listener('active')); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
  expect(props.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
});

test('a realtime throttle scheduled in foreground does not start a read after going inactive', async () => {
  await mount();
  act(() => { event(); jest.advanceTimersByTime(100); });
  AppState.currentState='inactive';
  act(() => jest.advanceTimersByTime(50)); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(1);
  AppState.currentState='active';
  act(() => { event(); jest.advanceTimersByTime(150); }); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
});

test('a queued follow-up waits for foreground when the running read times out in background', async () => {
  let listener;
  AppState.addEventListener.mockImplementation((name, callback) => { listener=callback; return {remove:jest.fn()}; });
  getPosWebsiteOrders.mockImplementationOnce(() => new Promise(() => {}));
  await mount();
  act(() => { event(); jest.advanceTimersByTime(150); });
  AppState.currentState='background'; act(() => listener('background'));
  act(() => { event(); jest.advanceTimersByTime(11000); }); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(1);
  expect(getPosWebsiteOrders.mock.calls[0][0].signal.aborted).toBe(true);
  expect(props.setLoading).toHaveBeenLastCalledWith(false);
  expect(props.setError).toHaveBeenLastCalledWith(expect.stringContaining('10 giây'));
  AppState.currentState='active'; act(() => listener('active')); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
  expect(props.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
  expect(props.setError).toHaveBeenLastCalledWith('');
});

test('realtime rejoin catches up immediately and continuous events do not postpone refresh forever', async () => {
  await mount();
  act(() => { event({eventType:'SYNC'}); jest.advanceTimersByTime(150); }); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(2);
  act(() => { for(let i=0;i<12;i++) { event(); jest.advanceTimersByTime(50); } }); await flush();
  expect(getPosWebsiteOrders.mock.calls.length).toBeGreaterThan(2);
});

test('logout aborts an outstanding read, clears the queue and leaves no timer/subscription behind', async () => {
  let finishOld; getPosWebsiteOrders.mockImplementationOnce(() => new Promise(resolve => {finishOld=resolve;}));
  await mount();
  const signal=getPosWebsiteOrders.mock.calls[0][0].signal;
  const unsubscribe=subscribePosWebsiteOrderChanges.mock.results[0].value;
  act(() => tree.update(<Harness {...props} userId={null}/>)); await flush();
  expect(signal.aborted).toBe(true); expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(props.setPickupOrders).toHaveBeenLastCalledWith([]);
  const calls=getPosWebsiteOrders.mock.calls.length;
  act(() => jest.advanceTimersByTime(30000)); await flush();
  expect(getPosWebsiteOrders).toHaveBeenCalledTimes(calls);
  props.setPickupOrders.mockClear(); await act(async () => finishOld({pickupOrders:[{id:'old-user'}],deliveryOrders:[]})); await flush();
  expect(props.setPickupOrders).not.toHaveBeenCalled();
});

test('two devices using one account remain independent when one device has a stalled request', async () => {
  let otherTree;
  getPosWebsiteOrders.mockImplementationOnce(() => new Promise(() => {}));
  await mount();
  const other={...props,setPickupOrders:jest.fn(),setDeliveryOrders:jest.fn(),setLoading:jest.fn(),setError:jest.fn()};
  try {
    act(() => {otherTree=renderer.create(<Harness {...other}/>);}); await flush();
    expect(other.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
    expect(props.setPickupOrders).toHaveBeenLastCalledWith([]);
    act(() => jest.advanceTimersByTime(11000)); await flush();
    expect(props.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
    expect(other.setPickupOrders).toHaveBeenLastCalledWith([{id:'new'}]);
  } finally {if(otherTree) act(() => otherTree.unmount());}
});

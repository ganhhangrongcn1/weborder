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
  subscribePosWebsiteOrderChanges.mockImplementation((branch, callback) => { event=callback; return jest.fn(); });
  getPosWebsiteOrders.mockResolvedValue({pickupOrders:[{id:'new'}],deliveryOrders:[]});
  props={branchUuid:'branch',userId:'staff',setPickupOrders:jest.fn(),setDeliveryOrders:jest.fn(),setLoading:jest.fn(),setError:jest.fn()};
});
afterEach(() => { if(tree) act(() => tree.unmount()); tree=null; jest.clearAllTimers(); jest.useRealTimers(); });
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

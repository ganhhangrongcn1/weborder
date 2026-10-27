/* global jest, test, expect, beforeEach */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import PosPickupOrdersPanel from '../src/features/pos/components/PosPickupOrdersPanel';
import PaymentBar from '../src/features/pos/components/PaymentBar';
import { isZeroPosOrder } from '../src/services/pos/posZeroOrderPolicy';
import { markWebsiteOrderPaidCash, markWebsiteOrderPaidQr } from '../src/services/pos/posPickupOrderService';
import { supabase } from '../src/services/supabase/client';
jest.mock('../src/services/supabase/client', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
const zero = { id:'zero', totalAmount:0, paymentAmount:20000, paymentStatus:'unpaid', fulfillmentType:'pickup', metadata:{} };
const texts = tree => tree.root.findAllByType(Text).map(node => node.props.children);
const button = (tree, label) => tree.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(text => text.props.children === label));
beforeEach(() => jest.clearAllMocks());
test('explicit zero is respected over a stale payment amount; unknown totals are not zero', () => {
  expect(isZeroPosOrder(zero)).toBe(true);
  expect(isZeroPosOrder({})).toBe(false);
  expect(isZeroPosOrder({totalAmount:30000})).toBe(false);
});
test('website zero order exposes one confirmation action and no cash/QR actions', () => {
  const confirm=jest.fn(), qr=jest.fn(); let tree;
  act(() => { tree=renderer.create(<PosPickupOrdersPanel pickupOrders={[zero]} onPayCash={confirm} onPayQr={qr}/>); });
  expect(texts(tree)).toContain('Chờ xác nhận đơn 0đ');
  expect(button(tree,'QR')).toBeUndefined(); expect(button(tree,'Tiền mặt')).toBeUndefined();
  act(() => button(tree,'Xác nhận đơn 0đ').props.onPress());
  expect(confirm).toHaveBeenCalledWith(zero); expect(qr).not.toHaveBeenCalled();
  act(() => tree.update(<PosPickupOrdersPanel pickupOrders={[{...zero,paymentStatus:'paid'}]} onPayCash={confirm} onPayQr={qr}/>));
  expect(button(tree,'Xác nhận đơn 0đ')).toBeUndefined();
  expect(texts(tree)).toContain('Đã xác nhận đơn 0đ');
  act(() => tree.unmount());
});
test('a paid-item order retains cash and QR choices; main zero composer hides QR', () => {
  let tree;
  act(() => { tree=renderer.create(<PosPickupOrdersPanel pickupOrders={[{...zero,totalAmount:30000}]} onPayCash={()=>{}} onPayQr={()=>{}}/>); });
  expect(button(tree,'QR')).toBeDefined(); expect(button(tree,'Tiền mặt')).toBeDefined();
  act(() => tree.update(<PaymentBar totals={{total:0}}/>));
  expect(button(tree,'QR')).toBeUndefined(); expect(button(tree,'Xác nhận đơn 0đ')).toBeDefined();
  act(() => tree.unmount());
});
test('zero confirmation updates the original order as counter with zero collected; QR is rejected before writes', async () => {
  let patch; const eq=jest.fn();
  supabase.from.mockReturnValue({update: value => {patch=value;return {eq:(key,id)=>{eq(key,id);return {select:()=>({maybeSingle:async()=>({data:{id:'zero',total_amount:0,customer_phone:'0901234567',...value}})})};}};}});
  const result=await markWebsiteOrderPaidCash({order:zero,shift:{id:'shift'},paymentAmount:0});
  expect(result.ok).toBe(true); expect(eq).toHaveBeenCalledWith('id','zero');
  expect(patch.payment_method).toBe('counter'); expect(patch.metadata.paymentAmount).toBe(0);
  expect(patch.metadata.paymentStatus).toBe('paid');
  supabase.from.mockClear();
  expect((await markWebsiteOrderPaidQr({order:zero,shift:{id:'shift'}})).ok).toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
});

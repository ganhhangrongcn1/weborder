import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Pressable, Text} from 'react-native';
import PosHistoryPanel from '../src/features/pos/components/PosHistoryPanel';
import PosOrderDetailModal from '../src/features/pos/components/PosOrderDetailModal';

jest.mock('../src/features/pos/components/PosOrderDetailModal', () => jest.fn(() => null));

const orders = [
  {id: 'cashier', displayOrderCode: 'POS-1', posShiftId: 'shift', status: 'preparing', metadata: {}},
  {id: 'phone', displayOrderCode: 'PHONE-1', posShiftId: 'shift', status: 'pending_payment', metadata: {deviceMode: 'phone'}},
  {id: 'old', displayOrderCode: 'OLD-1', posShiftId: 'old-shift', status: 'preparing', metadata: {}}
];
const button = (tree, label) => tree.root.findAllByType(Pressable).reverse().find(node =>
  node.findAllByType(Text).some(text => text.props.children === label));
const hasText = (tree, label) => tree.root.findAllByType(Text).some(node => node.props.children === label);

test('phone history shows cashier and phone orders in the current shift and filters unpaid orders correctly', () => {
  let tree;
  act(() => { tree = renderer.create(<PosHistoryPanel recentOrders={orders} activeShiftId="shift" phoneMode compact />); });
  expect(hasText(tree, 'POS-1')).toBe(true);
  expect(hasText(tree, 'PHONE-1')).toBe(true);
  expect(hasText(tree, 'OLD-1')).toBe(false);
  act(() => { button(tree, 'Chờ thanh toán (1)').props.onPress(); });
  expect(hasText(tree, 'PHONE-1')).toBe(true);
  expect(hasText(tree, 'POS-1')).toBe(false);
  act(() => { tree.unmount(); });
});

test('viewing cashier history on the phone does not expose cancellation of cashier orders', async () => {
  let tree;
  const open = jest.fn(async order => ({...order, canCancel: true}));
  act(() => { tree = renderer.create(<PosHistoryPanel recentOrders={orders} activeShiftId="shift" phoneMode onOpenOrderDetail={open} />); });
  await act(async () => { await button(tree, 'POS-1').props.onPress(); });
  expect(tree.root.findByType(PosOrderDetailModal).props.order.canCancel).toBe(false);
  await act(async () => { await button(tree, 'PHONE-1').props.onPress(); });
  expect(tree.root.findByType(PosOrderDetailModal).props.order.canCancel).toBe(true);
  act(() => { tree.unmount(); });
});

test('phone pending orders resume payment while cashier mode does not show phone payment buttons', () => {
 const cash=jest.fn(),qr=jest.fn(); let tree;
 act(()=>{tree=renderer.create(<PosHistoryPanel recentOrders={orders} activeShiftId="shift" phoneMode onPayCash={cash} onPayQr={qr} />);});
 act(()=>{button(tree,'Tiền mặt').props.onPress({stopPropagation:jest.fn()}); button(tree,'QR').props.onPress({stopPropagation:jest.fn()});});
 expect(cash).toHaveBeenCalledWith(orders[1]);expect(qr).toHaveBeenCalledWith(orders[1]);
 act(()=>{tree.update(<PosHistoryPanel recentOrders={orders} activeShiftId="shift" onPayCash={cash} onPayQr={qr}/>);});
 expect(button(tree,'Tiền mặt')).toBeUndefined();act(()=>tree.unmount());
});

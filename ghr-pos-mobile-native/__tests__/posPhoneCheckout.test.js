/* global jest, test, expect */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Pressable, Text} from 'react-native';
import PosPickupOrdersPanel from '../src/features/pos/components/PosPickupOrdersPanel';

const orders = [
  {id: 'new', displayOrderCode: 'NEW-1', totalAmount: 35000, paymentStatus: 'unpaid', fulfillmentType: 'pickup', metadata: {deviceMode: 'phone', pagerNumber: '02'}},
  {id: 'other', displayOrderCode: 'OTHER-1', totalAmount: 20000, paymentStatus: 'unpaid', metadata: {deviceMode: 'phone'}}
];

test('a newly created phone order goes straight to cash or QR without preorder labels or unrelated orders', () => {
  const cash = jest.fn();
  const qr = jest.fn();
  let tree;
  act(() => { tree = renderer.create(<PosPickupOrdersPanel phoneMode focusedOrderId="new" pickupOrders={orders} onPayCash={cash} onPayQr={qr} />); });
  const texts = () => tree.root.findAllByType(Text).map(node => node.props.children);
  const button = label => tree.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(text => text.props.children === label));
  expect(texts()).toContain('NEW-1');
  expect(texts()).toContain('Thanh toán');
  expect(texts()).toContain('Chưa gửi bếp');
  for (const label of ['OTHER-1', 'Đơn website', 'Hẹn lấy', 'Giao hàng', 'Đơn hẹn']) expect(texts()).not.toContain(label);
  act(() => { button('Tiền mặt').props.onPress(); button('QR').props.onPress(); });
  expect(cash).toHaveBeenCalledWith(orders[0]);
  expect(qr).toHaveBeenCalledWith(orders[0]);
  act(() => { tree.update(<PosPickupOrdersPanel phoneMode focusedOrderId="new" pickupOrders={[{...orders[0], paymentStatus: 'paid'}, orders[1]]} />); });
  expect(texts()).toContain('Thanh toán hoàn tất');
  expect(button('Tiền mặt')).toBeUndefined();
  expect(button('QR')).toBeUndefined();
  act(() => { tree.unmount(); });
});

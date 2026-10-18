/* global test, expect, jest */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BackHandler, Keyboard, Pressable, Text } from 'react-native';
import PosPhoneSaleWorkspace from '../src/features/pos/components/PosPhoneSaleWorkspace';

test('phone checkout requires a free pager, preserves supplied payment and returns to menu after cart clears', () => {
  const onChoosePager = jest.fn();
  let handleBack;
  const backListener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
    handleBack = handler;
    return { remove: jest.fn() };
  });
  const keyboardVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const props = { cart: [{ quantity: 2 }], totals: { total: 50000 },
    menu: <Text>Menu thử</Text>, customer: <Text>Khách thử</Text>, cartPanel: <Text>Món thử</Text>,
    payment: <Text>Thanh toán thử</Text>, onChoosePager };
  let tree;
  act(() => { tree = renderer.create(<PosPhoneSaleWorkspace {...props} />); });
  const buttonWith = (label) => tree.root.findAllByType(Pressable).find(node =>
    node.findAllByType(Text).some(text => (Array.isArray(text.props.children) ? text.props.children.join('') : text.props.children) === label));
  act(() => { buttonWith('Giỏ · 2 món').props.onPress(); });
  keyboardVisible.mockReturnValue(true);
  act(() => { expect(handleBack()).toBe(true); });
  expect(dismissKeyboard).toHaveBeenCalledTimes(1);
  expect(buttonWith('Chọn thẻ ›')).toBeTruthy();
  keyboardVisible.mockReturnValue(false);
  expect(buttonWith('Thanh toán').props.disabled).toBe(true);
  act(() => { buttonWith('Chọn thẻ ›').props.onPress(); });
  expect(onChoosePager).toHaveBeenCalledTimes(1);
  act(() => { tree.update(<PosPhoneSaleWorkspace {...props} pager="02" pagerBusy />); });
  expect(buttonWith('Thanh toán').props.disabled).toBe(true);
  act(() => { tree.update(<PosPhoneSaleWorkspace {...props} pager="02" />); });
  expect(buttonWith('Thanh toán').props.disabled).toBe(false);
  act(() => { buttonWith('Thanh toán').props.onPress(); });
  expect(tree.root.findAllByType(Text).some(node => node.props.children === 'Thanh toán thử')).toBe(true);
  act(() => { buttonWith('‹ Giỏ hàng').props.onPress(); });
  expect(buttonWith('Chọn thẻ ›')).toBeTruthy();
  act(() => { tree.update(<PosPhoneSaleWorkspace {...props} cart={[]} />); });
  expect(tree.root.findAllByType(Text).some(node => node.props.children === 'Menu thử')).toBe(true);
  act(() => { tree.unmount(); });
  backListener.mockRestore();
  keyboardVisible.mockRestore();
  dismissKeyboard.mockRestore();
});

test('phone mode creates a pending order from cart and never opens the cashier payment screen', () => {
  const onSendOrder = jest.fn();
  const props = { orderMode: true, pager: '02', cart: [{ quantity: 1 }], totals: { total: 25000 },
    menu: <Text>Menu</Text>, cartPanel: <Text>Giỏ</Text>, payment: <Text>Cashier payment</Text>, onSendOrder };
  let tree;
  act(() => { tree = renderer.create(<PosPhoneSaleWorkspace {...props} />); });
  const button = (label) => tree.root.findAllByType(Pressable).find(node => node.findAllByType(Text).some(text => text.props.children === label));
  act(() => { button('Giỏ · 1 món').props.onPress(); });
  act(() => { tree.update(<PosPhoneSaleWorkspace {...props} busy />); });
  expect(button('Tiền mặt').props.disabled).toBe(true);
  expect(button('QR').props.disabled).toBe(true);
  act(() => { tree.update(<PosPhoneSaleWorkspace {...props} />); });
  act(() => { button('QR').props.onPress(); });
  expect(onSendOrder).toHaveBeenCalledWith('bank_qr');
  act(() => { button('Tiền mặt').props.onPress(); });
  expect(onSendOrder).toHaveBeenCalledWith('cash');
  expect(tree.root.findAllByType(Text).some(text => text.props.children === 'Cashier payment')).toBe(false);
  act(() => tree.unmount());
});

test('zero price stamp gift only offers cash confirmation without a QR transfer', () => {
 let tree;const send=jest.fn();
 act(()=>{tree=renderer.create(<PosPhoneSaleWorkspace orderMode pager="02" cart={[{quantity:1}]} totals={{total:0}} onSendOrder={send}/>);});
 const button=label=>tree.root.findAllByType(Pressable).find(n=>n.findAllByType(Text).some(t=>t.props.children===label));
 act(()=>button('Giỏ · 1 món').props.onPress());
 expect(button('QR')).toBeUndefined();act(()=>button('Đổi quà').props.onPress());
 expect(send).toHaveBeenCalledWith('cash');act(()=>tree.unmount());
});

test('phone cart shows benefits, discount breakdown and total alongside payment actions',()=>{
 const open=jest.fn();let tree;
 act(()=>{tree=renderer.create(<PosPhoneSaleWorkspace orderMode pager="02" cart={[{quantity:1}]} totals={{subtotal:35000,voucherDiscount:1000,pointsDiscount:5000,total:29000}} loyaltyBenefit={{pointsSpent:5000}} onOpenBenefit={open}/>);});
 const button=label=>tree.root.findAllByType(Pressable).find(n=>n.findAllByType(Text).some(t=>t.props.children===label));
 act(()=>button('Giỏ · 1 món').props.onPress());
 const texts=tree.root.findAllByType(Text).map(t=>Array.isArray(t.props.children)?t.props.children.join(''):t.props.children);
 expect(texts).toContain('Tạm tính');expect(texts).toContain('Voucher');expect(texts).toContain('Đổi 5.000 điểm');expect(texts).toContain('Cần thanh toán');
 act(()=>button('Ưu đãi').props.onPress());expect(open).toHaveBeenCalledTimes(1);
 expect(button('Tiền mặt')).toBeTruthy();expect(button('QR')).toBeTruthy();act(()=>tree.unmount());
});

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Pressable, Text} from 'react-native';
import PosOrderDetailModal from '../src/features/pos/components/PosOrderDetailModal';

test('phone pending detail labels unpaid correctly and resumes QR; cashier order keeps its existing actions', () => {
  const qr=jest.fn(),close=jest.fn();
  const order={id:'phone',status:'pending_payment',paymentStatus:'unpaid',metadata:{deviceMode:'phone'},items:[],totals:{total:30000}};
  let tree;
  act(()=>{tree=renderer.create(<PosOrderDetailModal visible order={order} onPayQr={qr} onClose={close}/>);});
  const texts=()=>tree.root.findAllByType(Text).map(n=>n.props.children);
  const button=label=>tree.root.findAllByType(Pressable).reverse().find(n=>n.findAllByType(Text).some(t=>t.props.children===label));
  expect(texts()).toContain('Chờ thanh toán');expect(texts()).toContain('Chưa thanh toán');
  act(()=>button('Mở QR').props.onPress());expect(close).toHaveBeenCalledTimes(1);expect(qr).toHaveBeenCalledWith(order);
  act(()=>tree.update(<PosOrderDetailModal visible order={{...order,metadata:{}}} onPayQr={qr}/>));
  expect(button('Mở QR')).toBeUndefined();act(()=>tree.unmount());
});

/* global jest, test, expect */
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import {Pressable} from 'react-native';
jest.mock('react-native-qrcode-svg',()=> 'QRCode');
import QrPaymentModal from '../src/features/pos/components/QrPaymentModal';
const branch={paymentSettings:{provider:'sepay',bankBin:'970422',accountNumber:'00123456789',accountName:'TEST'}};
test('changed benefits show amount and require explicit action, without showing a QR or retrying automatically',()=>{
  const retry=jest.fn();let tree;
  act(()=>{tree=renderer.create(<QrPaymentModal visible branch={branch} amount={20000}
    benefitQuote={{total:20000}} errorMessage="Ưu đãi đã thay đổi" onRetry={retry}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Xác nhận số tiền mới và tạo QR');
  expect(tree.root.findAllByType('QRCode')).toHaveLength(0);expect(retry).not.toHaveBeenCalled();
  const button=tree.root.findAllByType(Pressable).find(node=>node.props.onPress===retry);
  act(()=>button.props.onPress());expect(retry).toHaveBeenCalledTimes(1);
});
test('zero-total quote directs cashier back to the existing zero-order flow',()=>{
  let tree;act(()=>{tree=renderer.create(<QrPaymentModal visible branch={branch} amount={0}
    benefitQuote={{total:0}} onRetry={()=>{}}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Đóng để xác nhận đơn 0đ');
  expect(tree.root.findAllByType('QRCode')).toHaveLength(0);
});

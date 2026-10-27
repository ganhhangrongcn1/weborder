/* global jest, test, expect */
jest.mock('../src/services/pos/posPrinterService',()=>({playLocalNewOrderAlert:jest.fn(async()=>true),playLocalWebsiteOrderAlert:jest.fn(async()=>true),playLocalQrPaymentAlert:jest.fn(async()=>true)}));
import {playPosOrderAlert,getWebsiteOrderAlertChanges,isWebsiteOrderPaid} from '../src/services/pos/posOrderAlertService';
import {playLocalWebsiteOrderAlert,playLocalQrPaymentAlert} from '../src/services/pos/posPrinterService';

test('initial history is silent; new paid MoMo order and unpaid-to-paid transition are classified as payment',()=>{
  const pending={id:'a',paymentStatus:'unpaid'},paid={...pending,paymentStatus:'paid',paymentMethod:'momo'};
  const initial=getWebsiteOrderAlertChanges([pending]);expect(initial.events).toEqual([]);
  const changed=getWebsiteOrderAlertChanges([paid],initial.next);expect(changed.events).toEqual([paid]);expect(isWebsiteOrderPaid(changed.events[0])).toBe(true);
  expect(getWebsiteOrderAlertChanges([paid],changed.next).events).toEqual([]);
  expect(getWebsiteOrderAlertChanges([paid],new Map()).events).toEqual([paid]);
});
test('sync and print job share a canonical id; paid alerts cannot regress to preorder or play twice',async()=>{
  await playPosOrderAlert('GHR-ALERT-1','paid');await playPosOrderAlert('ghr-alert-1','paid');await playPosOrderAlert('GHR-ALERT-1','website');
  expect(playLocalQrPaymentAlert).toHaveBeenCalledTimes(1);expect(playLocalWebsiteOrderAlert).not.toHaveBeenCalled();
});
test('a real unpaid preorder may upgrade to payment once',async()=>{
  await playPosOrderAlert('GHR-ALERT-2','website');await playPosOrderAlert('GHR-ALERT-2','paid');
  expect(playLocalWebsiteOrderAlert).toHaveBeenCalledTimes(1);expect(playLocalQrPaymentAlert).toHaveBeenCalledTimes(2);
});

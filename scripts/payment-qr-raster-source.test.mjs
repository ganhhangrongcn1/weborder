import test from 'node:test';
import assert from 'node:assert/strict';
import {getPaymentQrRasterSource} from '../src/services/paymentQrImageService.js';

test('bypass the non-CORS PNG redirect without changing payment information',()=>{
  const original='https://img.vietqr.io/image/970422-00123456789-compact2.png?amount=2800&addInfo=POS-20261102-201308&accountName=TEST';
  const result=new URL(getPaymentQrRasterSource(original));
  assert.equal(result.pathname,'/image/970422-00123456789-compact2.svg');
  assert.equal(result.search,new URL(original).search);
});
test('do not rewrite other hosts, data images or existing SVG images',()=>{
  for(const url of ['https://example.com/image/test.png','data:image/png;base64,abc','https://img.vietqr.io/image/test.svg','not a URL']) {
    assert.equal(getPaymentQrRasterSource(url),url);
  }
});

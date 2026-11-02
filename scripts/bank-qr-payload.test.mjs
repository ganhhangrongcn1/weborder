import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBankQrPayload,crc16,localizeBankQrUrl} from '../ghr-pos-mobile-native/src/shared/pos/bankQrPayload.js';
function readTlv(value){const fields={};let i=0;while(i<value.length){const id=value.slice(i,i+2);const length=Number(value.slice(i+2,i+4));assert.ok(Number.isInteger(length));fields[id]=value.slice(i+4,i+4+length);i+=4+length;}assert.equal(i,value.length);return fields;}
test('CRC matches the independent CCITT-FALSE check vector',()=>assert.equal(crc16('123456789'),'29B1'));
test('MB payload preserves leading zero account, exact amount and full payment reference',()=>{
  const payload=buildBankQrPayload({bankBin:'970422',accountNumber:'00123456789',amount:2400,reference:'GHR261102163510739'});
  const tags=readTlv(payload);const bank=readTlv(readTlv(tags['38'])['01']);
  assert.equal(bank['00'],'970422');assert.equal(bank['01'],'00123456789');
  assert.equal(tags['54'],'2400');assert.equal(tags['53'],'704');assert.equal(readTlv(tags['62'])['08'],'GHR261102163510739');
  assert.equal(payload.slice(-4),crc16(payload.slice(0,-4)));
});
test('legacy image URL is converted to exactly the same payload for local printing',()=>{
  const input={bankBin:'970403',accountNumber:'00009999',amount:25000,reference:'POS-20261102-123456'};
  assert.equal(localizeBankQrUrl('https://img.vietqr.io/image/970403-00009999-compact2.png?amount=25000&addInfo=POS-20261102-123456'),buildBankQrPayload(input));
  assert.equal(localizeBankQrUrl('https://example.invalid/loyalty'),'https://example.invalid/loyalty');
});
test('invalid or truncated money/account/reference never become a scannable payment',()=>{
  const valid={bankBin:'970422',accountNumber:'00123456789',amount:2400,reference:'GHR261102163510739'};
  for(const patch of [{amount:0},{amount:2.5},{amount:NaN},{bankBin:'MB'},{accountNumber:'abc'},{reference:'a'.repeat(100)}])assert.equal(buildBankQrPayload({...valid,...patch}),'');
});

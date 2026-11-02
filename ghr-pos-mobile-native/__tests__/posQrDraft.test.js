/* global jest, beforeEach, test, expect */
jest.mock('@react-native-async-storage/async-storage', () => ({getItem:jest.fn(),setItem:jest.fn(),removeItem:jest.fn()}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getPosQrDraftIdentity,forgetPosQrDraft} from '../src/services/pos/posQrDraftService';
let saved;
beforeEach(()=>{jest.clearAllMocks();saved=null;
  AsyncStorage.getItem.mockImplementation(async()=>saved);
  AsyncStorage.setItem.mockImplementation(async(key,value)=>{saved=value;});
  AsyncStorage.removeItem.mockImplementation(async()=>{saved=null;});
});
test('unchanged bill survives reload without another server round trip or new identity',async()=>{
  const recover=jest.fn();const input={branchUuid:'branch',fingerprint:'same-bill',recover};
  const identity=await getPosQrDraftIdentity(input);
  expect(JSON.parse(saved).identity.orderCode).toBe(identity.orderCode);
  expect(await getPosQrDraftIdentity(input)).toEqual(identity);
  expect(recover).not.toHaveBeenCalled();
});
test('changed cart cannot replace an unresolved bank bill',async()=>{
  await getPosQrDraftIdentity({branchUuid:'branch',fingerprint:'old'});
  const original=saved;
  await expect(getPosQrDraftIdentity({branchUuid:'branch',fingerprint:'changed',recover:async()=>({ok:true,session:{status:'pending_payment'}})})).rejects.toThrow('Bill QR trước');
  expect(saved).toBe(original);
});
test('after successful completion or cancellation the same cart can become a new sale',async()=>{
  const input={branchUuid:'branch',fingerprint:'same'};
  const identity=await getPosQrDraftIdentity(input);
  await forgetPosQrDraft('branch','other-reference');expect(saved).not.toBeNull();
  await forgetPosQrDraft('branch',identity.orderCode);expect(saved).toBeNull();
  await getPosQrDraftIdentity(input);expect(saved).not.toBeNull();
});

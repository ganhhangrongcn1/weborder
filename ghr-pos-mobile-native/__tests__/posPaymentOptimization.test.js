/* global jest, test, expect, beforeEach */
jest.mock('../src/services/supabase/client', () => ({supabase:{from:jest.fn()}}));
import {supabase} from '../src/services/supabase/client';
import {refreshPosPaymentCustomer} from '../src/services/pos/posCustomerService';
import {compactPosQrCheckout} from '../src/services/pos/posPaymentSnapshotService';
import {buildPosLoyaltyBenefit} from '../src/shared/pos/posLoyalty';

const phone='0900000099';
const selected={id:'gift',code:'GIFT',discountType:'fixed',discountValue:10000,used:false};
let reads;let results;
beforeEach(()=>{
  reads=[];
  results={loyalty_accounts:{data:{total_points:9000,vouchers:[selected,{id:'used',code:'USED',used:true}]}},
    app_configs:{data:{value:{redeemPointUnit:1000,redeemValue:1000,maxRedemptionPercent:40}}},
    profiles:{data:[{phone,name:'Khách thử',registered:true}]}};
  supabase.from.mockImplementation(table=>{
    reads.push(table);
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>results[table],in:async()=>results[table]};
    return q;
  });
});
test('payment refresh reads only fresh entitlements/config/minimal profile, never order history or statistics',async()=>{
  const fresh=await refreshPosPaymentCustomer(phone,{phone,loyalty:{totalPoints:99999}});
  expect(reads.sort()).toEqual(['app_configs','loyalty_accounts','profiles']);
  expect(fresh.ok).toBe(true);expect(fresh.loyalty.totalPoints).toBe(9000);
  expect(fresh.registeredCustomer).toBe(true);
  expect(fresh.availableVouchers.map(v=>v.id)).toEqual(['gift']);
  expect(buildPosLoyaltyBenefit({subtotal:100000,customer:fresh,pointsInput:'50000'}).pointsSpent).toBe(9000);
});
test('read failure blocks payment validation rather than using stale points or default rules',async()=>{
  results.loyalty_accounts={error:{message:'offline'}};
  expect((await refreshPosPaymentCustomer(phone,{phone,loyalty:{totalPoints:99999}})).ok).toBe(false);
  results.loyalty_accounts={data:null};results.app_configs={error:{message:'offline'}};
  expect((await refreshPosPaymentCustomer(phone)).ok).toBe(false);
});
test('legacy voucherHistory remains usable; a different cached customer is not merged',async()=>{
  results.loyalty_accounts={data:{total_points:5000,voucherHistory:[selected]}};
  const fresh=await refreshPosPaymentCustomer(phone,{phone:'0911111111',privateHistory:'other customer'});
  expect(fresh.privateHistory).toBeUndefined();expect(fresh.availableVouchers[0].code).toBe('GIFT');
});
test('compact snapshot preserves totals, selected benefit and recovery data while dropping CRM history',async()=>{
  const customer=await refreshPosPaymentCustomer(phone,{phone,stats:{totalOrders:10},history:'x'.repeat(40000)});
  const input={checkout:{customerLookup:customer,selectedVoucherKey:'loyalty:gift',pointsDiscount:9000,
    totals:{total:51000},orderIdentity:{orderCode:'POS-TEST'},pagerEnabled:true},
    pendingOrder:{order:{id:'POS-TEST',total_amount:51000,metadata:{customerLookup:customer,pointsSpent:9000}},items:[{id:'item'}]}};
  const output=compactPosQrCheckout(input);
  expect(output.pendingOrder.items).toEqual(input.pendingOrder.items);
  expect(output.checkout.totals).toEqual(input.checkout.totals);
  expect(output.checkout.orderIdentity).toEqual(input.checkout.orderIdentity);
  expect(output.pendingOrder.order.metadata.pointsSpent).toBe(9000);
  expect(output.checkout.customerLookup.history).toBeUndefined();
  expect(JSON.stringify(output).length).toBeLessThan(JSON.stringify(input).length/10);
  const args={subtotal:100000,selectedVoucherId:'loyalty:gift',pointsInput:'9000'};
  const before=buildPosLoyaltyBenefit({...args,customer});
  const after=buildPosLoyaltyBenefit({...args,customer:output.checkout.customerLookup});
  expect(after.pointsSpent).toBe(before.pointsSpent);expect(after.voucherDiscount).toBe(before.voucherDiscount);
  expect(input.checkout.customerLookup.history.length).toBe(40000);
});

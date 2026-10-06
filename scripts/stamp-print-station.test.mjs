import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base = new URL('../ghr-pos-mobile-native/src/services/pos/', import.meta.url);
const context = vm.createContext({console, Date, Set, Map, Promise, setTimeout: (fn, ms) => { const t=setTimeout(fn, ms > 10000 ? ms : 1); if(ms>10000)t.unref();return t; },clearTimeout});
const printed=[]; const lookups=[]; const updates=[];
const job={id:'test-print',job_type:'customer_bill',source_type:'qr_order_bundle',created_at:new Date().toISOString(),payload:{text:'@@CENTER:PHIẾU LÀM MÓN',secondaryText:'@@CENTER:HÓA ĐƠN BÁN HÀNG\nĐÃ THANH TOÁN',order:{customerPhone:'0901234567'}}};
const chain={update(value){updates.push(value);return this;},eq(){return this;},gte(){return this;},select(){return this;},maybeSingle:async()=>({data:job}),then(resolve){return Promise.resolve({error:null}).then(resolve);}};
const receipt=new vm.SourceTextModule(fs.readFileSync(new URL('posStampReceipt.js',base),'utf8'),{context});
await receipt.link(()=>{});await receipt.evaluate();
function mock(values){return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});}
const dependencies={
 './posStampReceipt':receipt,
 './posStampService':mock({withPosStampSummary:async(order,phone,options)=>{lookups.push({phone,options});return {...order,stampSummary:{enabled:true,available:1}};}}),
 'react-native':mock({AppState:{currentState:'active'}}),
 '../supabase/client':mock({supabase:{from:()=>chain}}),
 './posPrinterService':mock({buildReceiptFooterQrUrl:()=>'',buildPosCustomerBillText:()=>'',playLocalNewOrderAlert:async()=>true,playLocalQrPaymentAlert:async()=>true,printLocalReceipt:async(payload)=>{printed.push({...payload,...receipt.namespace.placeStampsAfterLoyaltyQr(payload.text,payload.footerText)});}}),
};
const station=new vm.SourceTextModule(fs.readFileSync(new URL('posPrintStationService.js',base),'utf8')+'\nexport {processPrintJobOnce};',{context});
await station.link(name=>dependencies[name]);await station.evaluate();
for(let attempt=0;attempt<2;attempt++)assert.equal(await station.namespace.processPrintJobOnce(job,'branch','device'),true);
assert.equal(printed.length,4);
assert.equal(lookups.length,2,'one summary read per QR customer bill, including reprint');
assert(lookups.every(x=>x.phone==='0901234567'&&x.options.force));
for(const index of [0,2])assert(!printed[index].text.includes('@@STAMPS'),'preparation ticket must not show stamps');
for(const index of [1,3]){
 assert(!printed[index].text.includes('@@STAMPS'));
 assert(printed[index].footerText.includes('@@STAMPS:1'));
 assert(printed[index].footerText.indexOf('@@STAMPS:1')>printed[index].footerText.indexOf('@@QR'));
 assert(!printed[index].footerText.includes('@@STAMPEND'));
}
assert.equal(updates.filter(x=>x.status==='printed').length,2);
console.log('QR bundle customer receipt and reprint passed; one read per bill, no stamp-award call.');

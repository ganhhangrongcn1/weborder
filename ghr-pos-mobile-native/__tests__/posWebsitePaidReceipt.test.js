/* global jest, test, expect */
jest.mock('../src/services/supabase/client',()=>({supabase:null}));
jest.mock('../src/services/pos/posReceiptTemplateService',()=>({loadPosReceiptTemplate:async()=>({enabled:true})}));
import {buildPrintPayload} from '../src/services/pos/posPrintStationService';
import {buildPosCustomerBillText} from '../src/services/pos/posPrinterService';
import {applyReceiptTemplate} from '../src/services/pos/receiptTemplate';

test.each(['momo','bank_qr'])('%s bundle keeps one kitchen ticket and rebuilds its paid customer receipt from structured data',method=>{
  const order={id:`web-${method}`,displayOrderCode:'GHR-TEST',paymentMethod:method,paymentStatus:'paid',paidAt:'2026-10-27T03:51:00Z',expectedEarnPoints:240,subtotal:2400,totalAmount:2400,
    items:[{name:'Mì Trẻ Em',quantity:1,price:2400,total:2400,options:['Không cay'],note:'Ghi chú thử'}]};
  const payload=buildPrintPayload({source_type:'qr_order_bundle',order_id:order.id,job_type:'customer_bill',payload:{
    order,text:'@@CENTER:PHIẾU LÀM MÓN\n@@BIG:GHR-TEST\nMì Trẻ Em',secondaryText:'@@CENTER:GANH HANG RONG\n@@CENTER:HOA DON BAN HANG\nOLD MOMO LAYOUT',footerQrUrl:'https://ganhhangrong.vn/nhan-diem/'+'a'.repeat(64)}});
  expect(payload.text).toContain('PHIẾU LÀM MÓN');expect(payload.text).not.toContain('HÓA ĐƠN BÁN HÀNG');
  expect(payload.secondaryReceipt.text).toContain('HÓA ĐƠN BÁN HÀNG');
  expect(payload.secondaryReceipt.text).not.toContain('OLD MOMO LAYOUT');
  expect(payload.secondaryReceipt.text).toContain('Không cay');expect(payload.secondaryReceipt.text).toContain('Ghi chú thử');
  expect(payload.isQrPayment).toBe(true);expect(payload.alertKey).toBe(order.id);
  const compact=applyReceiptTemplate(payload.secondaryReceipt.text,{}, {expectedEarnPoints:240});
  expect(compact).toContain('Quét để nhận 240');expect(compact).toContain('2.400');
  expect(compact).not.toContain('CÒN PHẢI THU');
});

test('cash-at-counter website receipt uses the same compact template without changing collection amounts',async()=>{
  const {applyReceiptTemplate}=require('../src/services/pos/receiptTemplate');
  const text=buildPosCustomerBillText({order:{id:'web-cash',expectedEarnPoints:7000},cart:[{name:'Món thử',quantity:1,lineTotal:70000}],totals:{subtotal:70000,total:70000},paymentConfirmed:{method:'cash',paid:true,amount:70000,received:100000,change:30000}});
  const compact=applyReceiptTemplate(text,{}, {expectedEarnPoints:7000});
  expect(compact).toContain('Quét để nhận 7000');expect(compact).toContain('30.000');
  expect(compact).not.toContain('CÒN PHẢI THU');expect(compact).not.toContain('Mỗi ngày tối đa');
});

test('legacy ASCII MoMo text still passes through the shared template if structured items are unavailable',()=>{
  const old='@@CENTER:GANH HANG RONG\n@@CENTER:HOA DON BAN HANG\n@@BIG:GHR-OLD\nChi nhanh: Quán\n@@BOLDROW:1 x Mì Trẻ Em\t\n@@ROW:TONG DON\t2.400d\n@@BOLDROW:DA THANH TOAN MOMO\t2.400d\n@@BOLDROW:CON PHAI THU\t0d\n@@CENTER:*** KHONG THU THEM TIEN ***';
  const compact=applyReceiptTemplate(old,{},{});
  expect(compact).toContain('HÓA ĐƠN BÁN HÀNG');expect(compact).toContain('Mì Trẻ Em');expect(compact).toContain('2.400đ');
  expect(compact).not.toContain('CON PHAI THU');expect(compact).not.toContain('CÒN PHẢI THU');
});

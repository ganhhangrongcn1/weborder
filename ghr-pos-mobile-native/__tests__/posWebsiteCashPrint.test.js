/* global jest, test, expect */
jest.mock('../src/services/supabase/client',()=>({supabase:{from:jest.fn()}}));
import {supabase} from '../src/services/supabase/client';
import {readPosOrderForPrint} from '../src/services/pos/posOrderQueryService';
test('website counter receipt takes its expected points from the saved order without recalculation',async()=>{
  supabase.from.mockImplementation(table=>({select:()=>({eq:()=> table==='orders'
    ? {maybeSingle:async()=>({data:{id:'web-cash',total_amount:70000,subtotal:70000,expected_earn_points:7000,metadata:{}}})}
    : {order:async()=>({data:[{product_id:'dish',product_name:'Món',quantity:1,unit_price:70000,line_total:70000}]})}})}));
  const result=await readPosOrderForPrint('web-cash');
  expect(result.ok).toBe(true);expect(result.printableOrder.expectedEarnPoints).toBe(7000);
  expect(result.printableOrder.totals.total).toBe(70000);
});

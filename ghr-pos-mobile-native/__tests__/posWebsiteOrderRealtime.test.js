/* global jest, test, expect, beforeEach */
jest.mock('../src/services/supabase/client',() => ({supabase:{channel:jest.fn(),removeChannel:jest.fn()}}));
import {supabase} from '../src/services/supabase/client';
import {subscribePosWebsiteOrderChanges} from '../src/services/pos/posPickupOrderService';
let channel;
beforeEach(() => {
 jest.clearAllMocks();
 channel={on:jest.fn().mockReturnThis(),subscribe:jest.fn().mockReturnThis()};
 supabase.channel.mockReturnValue(channel);
});
test('each successful subscription/rejoin requests a fresh server snapshot', () => {
 const change=jest.fn(); const stop=subscribePosWebsiteOrderChanges('branch-a',change);
 const status=channel.subscribe.mock.calls[0][0];
 status('SUBSCRIBED'); status('CHANNEL_ERROR'); status('SUBSCRIBED');
 expect(change).toHaveBeenCalledTimes(2);
 expect(change).toHaveBeenLastCalledWith({eventType:'SYNC'});
 stop(); expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
});
test('website/phone order events are scoped to the branch and ordinary counter sales do not reload the website queue', () => {
 const change=jest.fn(); subscribePosWebsiteOrderChanges('branch-a',change);
 const receive=channel.on.mock.calls[0][2];
 receive({new:{id:'web',pickup_branch_uuid:'branch-a',metadata:{source:'online'}}});
 receive({new:{id:'phone',branch_uuid:'branch-a',metadata:{source:'pos_mobile',deviceMode:'phone'}}});
 receive({new:{id:'counter',branch_uuid:'branch-a',metadata:{source:'pos_mobile'}}});
 receive({new:{id:'foreign',branch_uuid:'branch-b',metadata:{source:'online'}}});
 expect(change).toHaveBeenCalledTimes(2);
});

test('the same cancellation signal reaches every page of a website-order read', async () => {
 const {getPosWebsiteOrders}=require('../src/services/pos/posPickupOrderService');
 const controller=new globalThis.AbortController();
 const pages=[];
 supabase.from=jest.fn(() => {
   let offset=0;
   const q={};
   for(const name of ['select','or','gte','lt','order']) q[name]=jest.fn(() => q);
   q.range=jest.fn((from) => {offset=from;return q;});
   q.abortSignal=jest.fn(() => q);
   q.then=(resolve,reject) => Promise.resolve({data:offset===0
     ? Array.from({length:10},(_,i)=>({id:`counter-${i}`,branch_uuid:'branch-a',metadata:{source:'pos_mobile'}}))
     : [{id:'web',branch_uuid:'branch-a',payment_method:'cash',metadata:{source:'online'}}],error:null}).then(resolve,reject);
   pages.push(q);return q;
 });
 const result=await getPosWebsiteOrders({branchUuid:'branch-a',limit:10,signal:controller.signal});
 expect(result.deliveryOrders.map(order => order.id)).toEqual(['web']);
 expect(pages).toHaveLength(2);
 for(const page of pages) expect(page.abortSignal).toHaveBeenCalledWith(controller.signal);
});

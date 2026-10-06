import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/stamp-validation/node_modules/@electric-sql/pglite/dist/index.js';
import { createStampRequestCache } from '../src/services/stampRequestCache.js';

const migrationParts = await Promise.all(['schema','functions','orders'].map(name => readFile(new URL(`../docs/supabase-sql/stamp-program-${name}.sql`,import.meta.url),'utf8')));
assert.equal((await readFile(new URL('../supabase/migrations/20261005085626_stamp_program.sql',import.meta.url),'utf8')).replace(/\r\n/g,'\n'),('begin;\n'+migrationParts.join('\n')+'\ncommit;\n').replace(/\r\n/g,'\n'),'release migration matches tested SQL');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
create table public.profiles(id uuid,auth_user_id uuid,phone text,role text,status text,branch_uuid uuid);
create table public.branches(id text,branch_uuid uuid,branch_code text,legacy_id text,slug text,pickup_enabled boolean);
insert into public.branches values('CN01','10000000-0000-0000-0000-000000000001','CN01',null,null,true);
create table public.products(id text primary key,name text,image text,price numeric,active boolean,visible boolean,metadata jsonb);
create table public.orders(id text primary key,order_code text,customer_phone text,customer_name text,fulfillment_type text,payment_method text,status text,
subtotal numeric,shipping_fee numeric,original_shipping_fee numeric,shipping_support_discount numeric,promo_discount numeric,promo_code text,points_discount numeric,points_earned integer,
total_amount numeric,branch_uuid uuid,branch_name text,branch_address text,pickup_branch_uuid uuid,pickup_branch_name text,pickup_branch_address text,
pickup_time_text text,delivery_address text,kitchen_status text,pos_shift_id uuid,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.order_items(id bigint generated always as identity primary key,order_id text references orders(id),product_id text,product_name text,quantity integer,unit_price numeric,line_total numeric,spice text,note text,toppings jsonb,option_groups jsonb,metadata jsonb,kitchen_item_status text);
create table public.partner_orders(id uuid primary key,branch_uuid uuid,customer_phone text,customer_phone_key text,claimed_customer_phone text,order_time timestamptz,created_at timestamptz default now(),total_amount numeric,order_status text);
insert into public.profiles values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','0901234567','admin','active',null);
insert into public.products values('gift-1','Món 1','',20000,true,true,'{}'),('gift-2','Món 2','',25000,true,true,'{}'),('gift-3','Món 3','',30000,true,true,'{}');
set request.uid='00000000-0000-0000-0000-000000000001';
`);
for (const file of ['schema','functions','orders']) await db.exec(await readFile(new URL(`../docs/supabase-sql/stamp-program-${file}.sql`,import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261006042354_stamp_partner_confirmation.sql',import.meta.url),'utf8'));
const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
const summary = async () => (await one('select public.get_stamp_summary($1) s',['0901234567'])).s;
await db.query('select public.save_stamp_program(true,$1)',[['gift-1','gift-2','gift-3']]);
await db.exec(`update stamp_private.program set starts_at=now()-interval '30 days'`);
async function purchase(id,day=0,amount=40000,status='completed') {
  await db.query(`insert into orders(id,customer_phone,status,total_amount,subtotal,created_at,metadata) values($1,'0901234567',$2,$3,$3,now()-($4||' days')::interval,'{}')`,[id,status,amount,String(day)]);
}
await purchase('one'); await purchase('two');
assert.equal((await summary()).balance,1,'same day counted once');
await db.exec(`update orders set status='cancelled' where id='one'`);
assert.equal((await summary()).balance,1,'other completed order preserves daily stamp');
await db.exec(`update orders set status='cancelled' where id='two'`);
assert.equal((await summary()).balance,0,'last qualifying cancellation reverses day');
await purchase('zero',1,0); assert.equal((await summary()).balance,0);
for(let i=1;i<=10;i++) await purchase(`earn-${i}`,i);
assert.equal((await summary()).balance,10);
await db.exec(`update orders set metadata='{"sync":true}' where id='earn-1'`);
assert.equal((await summary()).balance,10,'resync idempotent');
const order = (id) => ({id,order_code:id,customer_phone:'0901234567',customer_name:'Test',fulfillment_type:'pickup',payment_method:'counter',status:'preparing',subtotal:0,total_amount:0,branch_uuid:'10000000-0000-0000-0000-000000000001',metadata:{stampGiftProductId:'gift-1'}});
const item = {product_id:'gift-1',product_name:'Món 1',quantity:1,unit_price:0,line_total:0,toppings:[],metadata:{stampGift:true}};
await db.query('select public.checkout_stamp_order($1,$2)',[order('gift-a'),[item]]);
assert.equal((await summary()).held,10);
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[order('gift-b'),[item]]),/10 tem/);
await db.query('select public.checkout_stamp_order($1,$2)',[order('gift-a'),[item]]);
assert.equal((await summary()).held,10,'retry does not reserve twice');
await db.exec(`update orders set status='completed' where id='gift-a'`);
assert.equal((await summary()).balance,0); assert.equal((await summary()).held,0);
await db.exec(`update orders set status='completed' where id='gift-a'`);
assert.equal((await summary()).balance,0,'completion retry');
await db.exec(`update orders set status='cancelled' where id='gift-a'`);
assert.equal((await summary()).balance,10,'refund redeemed stamps');
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[order('bad-qty'),[{...item,quantity:2}]]),/đúng một/);
assert.equal((await summary()).held,0,'failed item insert rolls back reservation');
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[{...order('bad-pay'),payment_method:'bank_qr'},[item]]),/0đ/);
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[{...order('bad-ship'),fulfillment_type:'delivery'},[item]]),/nhận tại quán/);
await assert.rejects(db.query('select public.save_stamp_program(true,$1)',[null]),/3 món/);
await db.exec(`update products set metadata='{"availability":{"branchChannels":{"CN01":["pos"]}}}' where id='gift-1'`);
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[order('wrong-channel'),[item]]),/không còn áp dụng/);
await db.exec(`update products set metadata='{}' where id='gift-1'`);
await assert.rejects(db.exec(`delete from orders where id='earn-1'`),/không xóa/);
await assert.rejects(db.exec(`update orders set created_at=now() where id='earn-1'`),/thay khách hoặc ngày/);
await db.query('select public.save_stamp_program(false,$1)',[['gift-1','gift-2','gift-3']]);
await db.exec(`update orders set metadata='{"resync":true}' where id='earn-2'`);
assert.equal((await summary()).balance,10,'pause does not revoke past earnings');
await purchase('paused-new',12);assert.equal((await summary()).balance,10,'paused purchases do not earn');
await db.query('select public.save_stamp_program(true,$1)',[['gift-1','gift-2','gift-3']]);
await db.exec(`insert into partner_orders(id,customer_phone,order_time,total_amount,order_status) values
 ('20000000-0000-0000-0000-000000000001','+84901234567',now()-interval '1 day',45000,'completed')`);
assert.equal((await summary()).balance,10,'partner and POS same day share one stamp');
await db.exec(`update orders set status='refunded' where id='earn-1'`);
assert.equal((await summary()).balance,10,'partner keeps the shared daily stamp');
await db.exec(`update partner_orders set order_status='cancelled' where id='20000000-0000-0000-0000-000000000001'`);
assert.equal((await summary()).balance,9);
await assert.rejects(db.exec(`update partner_orders set customer_phone='' where id='20000000-0000-0000-0000-000000000001'`),/IDENTITY_CHANGED/);
await purchase('old-order',40);assert.equal((await summary()).balance,9,'pre-launch purchases excluded');
await db.exec(`insert into orders(id,customer_phone,status,total_amount,subtotal,metadata)
 values('old-offline','0901234567','pending_zalo',45000,45000,jsonb_build_object('source','pos_mobile','paymentStatus','paid','paidAt',now()-interval '40 days'))`);
assert.equal((await summary()).balance,9,'pre-launch offline purchases excluded after late sync');

await db.exec(`insert into profiles values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','0901234567','customer','active',null);
set request.uid='00000000-0000-0000-0000-000000000002';`);
await purchase('customer-forged',15);assert.equal((await summary()).balance,9,'customer cannot self-award a stamp');
await assert.rejects(db.exec(`update orders set status='cancelled' where id='earn-2'`),/Chỉ nhân viên/);
await db.exec(`grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;
grant select,insert,update,delete on orders,order_items to authenticated; grant select on profiles to authenticated;
grant usage on all sequences in schema public to authenticated; set role authenticated;`);
assert.equal((await summary()).balance,9,'authenticated owner may read summary through definer');
await assert.rejects(db.exec('select * from stamp_private.accounts'),/permission denied/);
await db.exec('reset role');
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000001'`);
await purchase('authenticated-checkout-balance',16);
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000002';set role authenticated;`);
await db.query('select public.checkout_stamp_order($1,$2)',[order('customer-valid'),[item]]);
assert.equal((await summary()).held,10,'authenticated customer can reserve through invoker RPC');
await assert.rejects(db.exec(`update orders set status='completed' where id='customer-valid'`),/nhân viên/);
await assert.rejects(db.query('select public.checkout_stamp_order($1,$2)',[{...order('other-owner'),customer_phone:'0909999999'},[item]]),/STAMP_FORBIDDEN/);
await db.exec('reset role');
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000099'`);
await assert.rejects(summary(),/STAMP_FORBIDDEN/);
await assert.rejects(db.query('select public.save_stamp_program(false,$1)',[[]]),/STAMP_FORBIDDEN/);
await db.exec(`set request.uid=''`);
assert.equal((await one("select public.get_stamp_summary('') s")).s.enabled,true,'public config without phone');
await assert.rejects(summary(),/STAMP_FORBIDDEN/);

// Accepted partner orders earn before delivery; status retries do not earn twice.
await db.exec(`set request.uid='00000000-0000-0000-0000-000000000001';
insert into partner_orders(id,customer_phone,order_time,total_amount,order_status) values
('20000000-0000-0000-0000-000000000002','0909999998',now(),45000,'new')`);
const partnerBalance = async () => (await one("select public.get_stamp_summary('0909999998') s")).s.balance;
assert.equal(await partnerBalance(),0,'new unaccepted order does not earn');
for (const status of ['confirmed','preparing','ready','completed','completed']) {
  await db.query("update partner_orders set order_status=$1 where id='20000000-0000-0000-0000-000000000002'",[status]);
  assert.equal(await partnerBalance(),1,`accepted status ${status} earns only once`);
}
await db.exec(`update partner_orders set order_status='cancelled' where id='20000000-0000-0000-0000-000000000002'`);
assert.equal(await partnerBalance(),0,'cancel reverses accepted order');
await db.exec(`update partner_orders set order_status='preparing' where id='20000000-0000-0000-0000-000000000002';
insert into partner_orders(id,customer_phone,order_time,total_amount,order_status) values
('20000000-0000-0000-0000-000000000003','0909999998',now(),45000,'preparing');
update partner_orders set order_status='refunded' where id='20000000-0000-0000-0000-000000000002'`);
assert.equal(await partnerBalance(),1,'another accepted purchase preserves the same daily stamp');
await db.exec(`update partner_orders set order_status='refunded' where id='20000000-0000-0000-0000-000000000003'`);
assert.equal(await partnerBalance(),0,'last refunded order reverses daily stamp');

let now=0;let calls=0;const cache=createStampRequestCache({now:()=>now});
const fetcher=async()=>{calls++;return {balance:4};};
await Promise.all(Array.from({length:20},()=>cache.get('user:phone',fetcher)));
assert.equal(calls,1,'20 simultaneous mounts share one request');
await cache.get('user:phone',fetcher);assert.equal(calls,1,'Home to Rewards uses cache');
now=61000;await cache.get('user:phone',fetcher);assert.equal(calls,2,'refresh after TTL');
cache.clear();await cache.get('user:phone',fetcher);assert.equal(calls,3,'checkout invalidates');
await cache.get('another-user:phone',fetcher);assert.equal(calls,4,'identity isolated');
for (const file of ['schema','functions','orders']) await db.exec(await readFile(new URL(`../docs/supabase-sql/stamp-program-${file}.sql`,import.meta.url),'utf8'));
console.log('Stamp SQL scenarios passed; request cache:',cache.stats);
await db.close();

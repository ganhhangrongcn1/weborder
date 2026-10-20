create role anon; create role authenticated;
create schema stamp_private;
create table stamp_private.program(id boolean primary key,enabled boolean);
insert into stamp_private.program values(true,true);
create table stamp_private.accounts(phone text primary key,balance int,held int);
insert into stamp_private.accounts values('0900000001',7,0);
create table stamp_private.sources(source text,order_id text,phone text,business_day date,active boolean);
create function stamp_private.phone(text) returns text language sql immutable as $$ select coalesce($1,'') $$;
create function stamp_private.is_operator(uuid) returns boolean language sql stable as $$ select true $$;
create table public.orders(id text primary key,order_code text,branch_uuid uuid,pickup_branch_uuid uuid,
 delivery_branch_name text,pickup_branch_name text,branch_name text,customer_phone text,customer_name text,
 subtotal numeric,total_amount numeric,shipping_fee numeric,payment_method text,status text,kitchen_status text,fulfillment_type text,metadata jsonb default '{}');
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id text,product_id text,product_name text,
 quantity numeric,unit_price numeric,line_total numeric,note text,toppings jsonb,option_groups jsonb);
create table public.print_jobs(id uuid primary key default gen_random_uuid(),branch_uuid text,printer_key text default 'cashier-80mm',job_type text default 'customer_bill',status text default 'pending',order_id text,order_code text,source_type text,payload jsonb default '{}',requested_by text);
create unique index print_jobs_one_active_order_id_idx on public.print_jobs(branch_uuid,printer_key,job_type,order_id) where status in ('pending','printing') and order_id is not null and order_id<>'';
create unique index print_jobs_one_active_order_code_idx on public.print_jobs(branch_uuid,printer_key,job_type,order_code) where status in ('pending','printing') and (order_id is null or order_id='') and order_code is not null and order_code<>'';
insert into public.orders(id,order_code,branch_uuid,pickup_branch_uuid,customer_phone,customer_name,subtotal,total_amount,payment_method,status,metadata)
 values('GHR261020184613234','GHR261020184613234','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','0900000001','Fixture',28000,28000,'bank_qr','done','{"source":"online","paymentStatus":"paid"}');
insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total,toppings,option_groups)
 values('GHR261020184613234','fixture','Fixture',1,28000,28000,'[]','[]');

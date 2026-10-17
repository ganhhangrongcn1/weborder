-- Prepare CN04 Grab review/finance source; credentials are entered through Admin.
-- Keep disabled until the correct GrabMerchant account is configured.
-- Rerunning preserves any source already configured by an operator.
insert into public.partner_review_sources (
  platform, account_key, display_name, branch_uuid, branch_code,
  auth_status, sync_status, sync_enabled, auto_reply_enabled
)
select
  'grabfood', 'grab_vietsing', b.name, b.branch_uuid, b.branch_code,
  'not_configured', 'idle', false, false
from public.branches b
where b.branch_uuid = 'b108f000-02dc-4f04-8a97-996bbfc27fb8'
  and b.branch_code = 'CN04'
  and not exists (
    select 1 from public.partner_review_sources s
    where s.platform = 'grabfood' and s.branch_uuid = b.branch_uuid
  )
on conflict (platform, account_key) do nothing;

-- Merchant ID supplied by the operator from GrabMerchant.
update public.partner_review_sources
set merchant_id = '5-C8EKJAE1WCADLA', updated_at = now()
where platform = 'grabfood'
  and account_key = 'grab_vietsing'
  and branch_uuid = 'b108f000-02dc-4f04-8a97-996bbfc27fb8'
  and branch_code = 'CN04'
  and (merchant_id is null or merchant_id = '5-C8EKJAE1WCADLA');

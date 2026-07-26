alter table public.nexpos_shadow_sync_control
  drop constraint if exists nexpos_shadow_sync_control_mode_check;

alter table public.nexpos_shadow_sync_control
  add constraint nexpos_shadow_sync_control_mode_check
  check (mode in ('disabled', 'compare_only', 'dual_write'));

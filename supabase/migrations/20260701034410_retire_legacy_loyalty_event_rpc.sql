-- Chỉ triển khai migration này sau khi mọi máy POS đã cài bản dùng
-- public.process_order_loyalty cho hành động SPEND.
--
-- Không dùng CASCADE: nếu production phát sinh dependency mới, migration
-- phải dừng để kiểm tra thay vì xóa lan sang object khác.

drop function if exists public.apply_loyalty_event(
  text,
  text,
  integer,
  text,
  numeric,
  text,
  text,
  jsonb,
  timestamptz
);

drop function if exists public.can_apply_loyalty_event(text, text);

notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure(
    'public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz)'
  ) is not null then
    raise exception 'Legacy RPC apply_loyalty_event vẫn còn tồn tại.';
  end if;

  if to_regprocedure('public.can_apply_loyalty_event(text,text)') is not null then
    raise exception 'Legacy RPC can_apply_loyalty_event vẫn còn tồn tại.';
  end if;
end;
$$;

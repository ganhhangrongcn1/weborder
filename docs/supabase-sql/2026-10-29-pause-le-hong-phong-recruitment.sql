-- Authorized operational change: pause recruitment at 306A Le Hong Phong only.
-- Config revision guard preserves concurrent Admin edits. No applicant writes.
begin;
do $$
declare
  current_settings public.recruitment_form_settings%rowtype;
  question_index integer;
  active_options jsonb;
  next_options jsonb;
  target text := '306A Lê Hồng Phong, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)';
begin
  select * into strict current_settings from public.recruitment_form_settings
    where id='default' for update;
  select (ordinality-1)::integer, value->'options'
    into strict question_index, active_options
    from jsonb_array_elements(current_settings.config->'questions') with ordinality
    where value->>'id'='branch';
  if not (active_options ? target) then return; end if;
  if current_settings.revision <> 4 then
    raise exception 'Recruitment settings changed: inspect latest revision before applying';
  end if;
  select jsonb_agg(value order by ordinality) into next_options
    from jsonb_array_elements(active_options) with ordinality where value <> to_jsonb(target);
  if jsonb_array_length(next_options) <> 3 then raise exception 'Unexpected branch count'; end if;
  update public.recruitment_form_settings
    set config=jsonb_set(current_settings.config,array['questions',question_index::text,'options'],next_options),
      revision=current_settings.revision+1, updated_at=now()
    where id='default' and revision=current_settings.revision;
  if not found then raise exception 'Concurrent recruitment settings edit'; end if;
end;
$$;
select revision,q->'options' as active_branches
from public.recruitment_form_settings,
  lateral jsonb_array_elements(config->'questions') q
where id='default' and q->>'id'='branch';
commit;

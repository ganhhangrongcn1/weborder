-- Roll back ONLY this join optimization. Does not restore the whole database.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
DO $guard$
DECLARE original text;
BEGIN
  SELECT pg_get_functiondef('public.get_admin_business_analytics(timestamptz,timestamptz,text,text)'::regprocedure) INTO original;
  IF md5(original) = '161492305a6f51cad1ae199771e4a2fe' THEN
    RETURN;
  END IF;
  IF md5(original) <> '07db4292ce164653cf84794009153cc5' THEN
    RAISE EXCEPTION 'Analytics definition changed; stop and review';
  END IF;
  IF length(original) - length(replace(original, 'on o.order_id::uuid = poi.partner_order_id', '')) <> length('on o.order_id::uuid = poi.partner_order_id') THEN
    RAISE EXCEPTION 'Expected exactly one partner join';
  END IF;
  EXECUTE replace(original, 'on o.order_id::uuid = poi.partner_order_id', 'on o.order_id = poi.partner_order_id::text');
END $guard$;
COMMIT;

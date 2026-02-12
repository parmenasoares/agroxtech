-- Ensure we can safely sync the currently authenticated user into public.users
-- without trusting client-provided email (prevents privilege escalation via spoofed email).

CREATE OR REPLACE FUNCTION public.ensure_current_user_row()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
  _email text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Email from JWT claims (trusted)
  _email := NULLIF(trim((current_setting('request.jwt.claims', true)::jsonb ->> 'email')), '');
  IF _email IS NULL THEN
    RAISE EXCEPTION 'email_missing';
  END IF;

  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (_uid, _email, now(), now())
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_row() TO authenticated;
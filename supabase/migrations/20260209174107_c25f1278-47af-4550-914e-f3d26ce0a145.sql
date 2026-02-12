-- RPCs para gestão de roles por e-mail (apenas SUPER_ADMIN)

CREATE OR REPLACE FUNCTION public.admin_set_user_role_by_email(
  _email text,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  -- Apenas SUPER_ADMIN pode executar
  IF NOT public.is_user_role(auth.uid(), 'SUPER_ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _email IS NULL OR length(trim(_email)) = 0 OR length(trim(_email)) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT id
  INTO _target_user_id
  FROM public.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Evita auto-elevação/rebaixamento acidental
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;

  -- Garante unicidade por user_id (um único role ativo)
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id;

  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_target_user_id, _role, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role_by_email(text, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_by_email(text, public.app_role) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_remove_user_role_by_email(
  _email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  -- Apenas SUPER_ADMIN pode executar
  IF NOT public.is_user_role(auth.uid(), 'SUPER_ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _email IS NULL OR length(trim(_email)) = 0 OR length(trim(_email)) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT id
  INTO _target_user_id
  FROM public.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_user_role_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_role_by_email(text) TO authenticated;

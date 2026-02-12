-- Strengthen server-side email format validation for role management RPCs

CREATE OR REPLACE FUNCTION public.admin_set_user_role_by_email(_email text, _role app_role)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _target_user_id uuid;
  _normalized_email text;
BEGIN
  -- Apenas SUPER_ADMIN pode executar
  IF NOT public.is_user_role(auth.uid(), 'SUPER_ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  _normalized_email := lower(trim(_email));

  IF _normalized_email IS NULL OR length(_normalized_email) = 0 OR length(_normalized_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Stronger format validation (server-side)
  -- Keep same error code to avoid breaking clients
  IF _normalized_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT id
  INTO _target_user_id
  FROM public.users
  WHERE lower(email) = _normalized_email
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
$function$;


CREATE OR REPLACE FUNCTION public.admin_remove_user_role_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _target_user_id uuid;
  _normalized_email text;
BEGIN
  -- Apenas SUPER_ADMIN pode executar
  IF NOT public.is_user_role(auth.uid(), 'SUPER_ADMIN'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  _normalized_email := lower(trim(_email));

  IF _normalized_email IS NULL OR length(_normalized_email) = 0 OR length(_normalized_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Stronger format validation (server-side)
  -- Keep same error code to avoid breaking clients
  IF _normalized_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT id
  INTO _target_user_id
  FROM public.users
  WHERE lower(email) = _normalized_email
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
$function$;

-- Fix RESTRICTIVE policy misconfiguration for SELECT on activities and user_roles

-- =========================
-- activities
-- =========================
DROP POLICY IF EXISTS "Coordenadores and above can view all activities" ON public.activities;
DROP POLICY IF EXISTS "Operators can view own activities" ON public.activities;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Operators can view own activities"
ON public.activities
FOR SELECT
USING (public.is_activity_owner(auth.uid(), id));

CREATE POLICY "Coordenadores and above can view all activities"
ON public.activities
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

-- =========================
-- user_roles
-- =========================
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_or_super_admin(auth.uid()));

-- Fix RLS misconfiguration on public.users (convert SELECT policies to PERMISSIVE)

-- Drop existing SELECT policies that were created as RESTRICTIVE
DROP POLICY IF EXISTS "Coordenadores and above can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Coordenadores and above can view all users"
ON public.users
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

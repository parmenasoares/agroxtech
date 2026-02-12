-- Allow OPERADOR users to read reference data needed to start an activity

-- =========================
-- machines
-- =========================
DROP POLICY IF EXISTS "Operators can view machines" ON public.machines;
CREATE POLICY "Operators can view machines"
ON public.machines
FOR SELECT
USING (public.is_operator(auth.uid()));

-- =========================
-- clients
-- =========================
DROP POLICY IF EXISTS "Operators can view clients" ON public.clients;
CREATE POLICY "Operators can view clients"
ON public.clients
FOR SELECT
USING (public.is_operator(auth.uid()));

-- =========================
-- locations
-- =========================
DROP POLICY IF EXISTS "Operators can view locations" ON public.locations;
CREATE POLICY "Operators can view locations"
ON public.locations
FOR SELECT
USING (public.is_operator(auth.uid()));

-- =========================
-- services
-- =========================
DROP POLICY IF EXISTS "Operators can view services" ON public.services;
CREATE POLICY "Operators can view services"
ON public.services
FOR SELECT
USING (public.is_operator(auth.uid()));

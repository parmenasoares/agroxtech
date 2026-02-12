-- Add Clients/Locations/Services and link them to activities

-- =========================
-- Tables
-- =========================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_locations_updated_at ON public.locations;
CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- activities columns
-- =========================
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS client_id uuid NULL,
  ADD COLUMN IF NOT EXISTS location_id uuid NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid NULL,
  ADD COLUMN IF NOT EXISTS performance_rating smallint NULL,
  ADD COLUMN IF NOT EXISTS area_value numeric NULL,
  ADD COLUMN IF NOT EXISTS area_unit text NULL,
  ADD COLUMN IF NOT EXISTS area_notes text NULL;

-- FKs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_client_fk'
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_location_fk'
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_service_fk'
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_service_fk FOREIGN KEY (service_id) REFERENCES public.services(id);
  END IF;
END $$;

-- Rating validation via trigger (avoid CHECK constraints policy)
CREATE OR REPLACE FUNCTION public.validate_activity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- performance rating 1..5 when provided
  IF NEW.performance_rating IS NOT NULL AND (NEW.performance_rating < 1 OR NEW.performance_rating > 5) THEN
    RAISE EXCEPTION 'invalid_performance_rating';
  END IF;

  -- end odometer must be > start odometer when provided
  IF NEW.end_odometer IS NOT NULL AND NEW.start_odometer IS NOT NULL AND NEW.end_odometer <= NEW.start_odometer THEN
    RAISE EXCEPTION 'end_odometer_must_be_greater';
  END IF;

  -- if end_time present, duration must be <= 18 hours and end >= start
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time THEN
      RAISE EXCEPTION 'end_time_before_start_time';
    END IF;
    IF (NEW.end_time - NEW.start_time) > interval '18 hours' THEN
      RAISE EXCEPTION 'activity_duration_exceeds_18h';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_activity_fields ON public.activities;
CREATE TRIGGER trg_validate_activity_fields
BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.validate_activity_fields();

-- =========================
-- RLS
-- =========================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Clients: view by coordenador+; CRUD by admin+
DROP POLICY IF EXISTS "Coordenadores can view clients" ON public.clients;
CREATE POLICY "Coordenadores can view clients"
ON public.clients
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
CREATE POLICY "Admins can manage clients"
ON public.clients
FOR ALL
USING (public.is_admin_or_super_admin(auth.uid()))
WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Locations
DROP POLICY IF EXISTS "Coordenadores can view locations" ON public.locations;
CREATE POLICY "Coordenadores can view locations"
ON public.locations
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
CREATE POLICY "Admins can manage locations"
ON public.locations
FOR ALL
USING (public.is_admin_or_super_admin(auth.uid()))
WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Services
DROP POLICY IF EXISTS "Coordenadores can view services" ON public.services;
CREATE POLICY "Coordenadores can view services"
ON public.services
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services"
ON public.services
FOR ALL
USING (public.is_admin_or_super_admin(auth.uid()))
WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Require rating on submit: for now enforce in app, but keep DB nullable to avoid breaking existing rows.

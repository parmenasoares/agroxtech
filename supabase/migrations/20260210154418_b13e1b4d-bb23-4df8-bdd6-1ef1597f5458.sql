-- Allow any authenticated user to read reference data needed to start an activity

-- Machines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'machines' AND policyname = 'Authenticated users can view machines'
  ) THEN
    CREATE POLICY "Authenticated users can view machines"
    ON public.machines
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Authenticated users can view clients'
  ) THEN
    CREATE POLICY "Authenticated users can view clients"
    ON public.clients
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Authenticated users can view locations'
  ) THEN
    CREATE POLICY "Authenticated users can view locations"
    ON public.locations
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Authenticated users can view services'
  ) THEN
    CREATE POLICY "Authenticated users can view services"
    ON public.services
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
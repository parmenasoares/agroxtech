-- Harden compatibility across module schemas and user bootstrap linkage.

-- 1) Keep public.users in sync with auth.users so FK inserts don't fail for new authenticated users.
CREATE OR REPLACE FUNCTION public.sync_public_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, NEW.id::text || '@placeholder.local'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_user_from_auth ON auth.users;
CREATE TRIGGER trg_sync_public_user_from_auth
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_user_from_auth();

-- Backfill existing authenticated users.
INSERT INTO public.users (id, email)
SELECT au.id, COALESCE(au.email, au.id::text || '@placeholder.local')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- 2) Ensure maintenance compatibility columns exist in environments with legacy/current variants.
ALTER TABLE IF EXISTS public.maintenance_requests
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS response text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maintenance_requests' AND column_name = 'problem_description'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maintenance_requests' AND column_name = 'mechanic_response'
  ) THEN
    UPDATE public.maintenance_requests
    SET
      description = COALESCE(description, problem_description),
      problem_description = COALESCE(problem_description, description),
      response = COALESCE(response, mechanic_response),
      mechanic_response = COALESCE(mechanic_response, response)
    WHERE true;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_maintenance_requests_compat_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_jsonb(NEW) ? 'problem_description' AND to_jsonb(NEW) ? 'description' THEN
    NEW.problem_description := COALESCE(NEW.problem_description, NEW.description);
    NEW.description := COALESCE(NEW.description, NEW.problem_description);
  END IF;

  IF to_jsonb(NEW) ? 'mechanic_response' AND to_jsonb(NEW) ? 'response' THEN
    NEW.mechanic_response := COALESCE(NEW.mechanic_response, NEW.response);
    NEW.response := COALESCE(NEW.response, NEW.mechanic_response);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'maintenance_requests'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_maintenance_requests_compat_columns ON public.maintenance_requests;
    CREATE TRIGGER trg_sync_maintenance_requests_compat_columns
    BEFORE INSERT OR UPDATE ON public.maintenance_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_maintenance_requests_compat_columns();
  END IF;
END
$$;

-- 3) Ensure storage bucket aliases exist for compatibility with deployed front-end variants.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('maintenance-requests', 'maintenance-requests', true),
  ('maintenance_requests', 'maintenance_requests', true),
  ('maintenance', 'maintenance', true),
  ('damage-reports', 'damage-reports', true),
  ('damages', 'damages', true),
  ('fuelings', 'fuelings', true),
  ('fuel-records', 'fuel-records', true)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage policies for compatibility buckets (idempotent).
DROP POLICY IF EXISTS "Users can upload own maintenance photos (compat)" ON storage.objects;
CREATE POLICY "Users can upload own maintenance photos (compat)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('maintenance-requests', 'maintenance_requests', 'maintenance')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can manage own maintenance photos (compat)" ON storage.objects;
CREATE POLICY "Users can manage own maintenance photos (compat)"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id IN ('maintenance-requests', 'maintenance_requests', 'maintenance')
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id IN ('maintenance-requests', 'maintenance_requests', 'maintenance')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload own damages photos (compat)" ON storage.objects;
CREATE POLICY "Users can upload own damages photos (compat)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('damage-reports', 'damages')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can manage own damages photos (compat)" ON storage.objects;
CREATE POLICY "Users can manage own damages photos (compat)"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id IN ('damage-reports', 'damages')
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id IN ('damage-reports', 'damages')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can manage fueling photos (compat)" ON storage.objects;
CREATE POLICY "Users can manage fueling photos (compat)"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id IN ('fuelings', 'fuel-records'))
WITH CHECK (bucket_id IN ('fuelings', 'fuel-records'));

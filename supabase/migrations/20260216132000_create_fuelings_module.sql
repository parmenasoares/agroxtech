-- Fuelings module: table + RLS + storage bucket policies

CREATE TABLE IF NOT EXISTS public.fuelings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  value numeric(12,2) NOT NULL,
  km_hours numeric(12,2) NOT NULL,
  image_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuelings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fuelings' AND policyname = 'Users can insert own fuelings'
  ) THEN
    CREATE POLICY "Users can insert own fuelings"
    ON public.fuelings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fuelings' AND policyname = 'Users can select own fuelings'
  ) THEN
    CREATE POLICY "Users can select own fuelings"
    ON public.fuelings
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fuelings' AND policyname = 'Users can update own fuelings'
  ) THEN
    CREATE POLICY "Users can update own fuelings"
    ON public.fuelings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_fuelings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fuelings_updated_at ON public.fuelings;
CREATE TRIGGER trg_fuelings_updated_at
BEFORE UPDATE ON public.fuelings
FOR EACH ROW
EXECUTE FUNCTION public.set_fuelings_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('fuelings', 'fuelings', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload fuelings images'
  ) THEN
    CREATE POLICY "Authenticated users can upload fuelings images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'fuelings' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update own fuelings images'
  ) THEN
    CREATE POLICY "Authenticated users can update own fuelings images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'fuelings' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'fuelings' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete own fuelings images'
  ) THEN
    CREATE POLICY "Authenticated users can delete own fuelings images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'fuelings' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read fuelings images'
  ) THEN
    CREATE POLICY "Public can read fuelings images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'fuelings');
  END IF;
END $$;

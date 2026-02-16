-- Damages module: report + photo + tracking status

CREATE TABLE IF NOT EXISTS public.damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_text text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANALISE', 'RESOLVIDO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'damage_reports' AND policyname = 'Users can insert own damage reports'
  ) THEN
    CREATE POLICY "Users can insert own damage reports"
    ON public.damage_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'damage_reports' AND policyname = 'Users can view own damage reports'
  ) THEN
    CREATE POLICY "Users can view own damage reports"
    ON public.damage_reports
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'damage_reports' AND policyname = 'Admins can view all damage reports'
  ) THEN
    CREATE POLICY "Admins can view all damage reports"
    ON public.damage_reports
    FOR SELECT
    USING (public.is_admin_or_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'damage_reports' AND policyname = 'Admins can update damage reports'
  ) THEN
    CREATE POLICY "Admins can update damage reports"
    ON public.damage_reports
    FOR UPDATE
    USING (public.is_admin_or_super_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_damage_reports_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER trg_damage_reports_updated_at
BEFORE UPDATE ON public.damage_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_damage_reports_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-reports', 'damage-reports', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload damage photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload damage photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'damage-reports' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update own damage photos'
  ) THEN
    CREATE POLICY "Authenticated users can update own damage photos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'damage-reports' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'damage-reports' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete own damage photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete own damage photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'damage-reports' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read damage photos'
  ) THEN
    CREATE POLICY "Public can read damage photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'damage-reports');
  END IF;
END $$;

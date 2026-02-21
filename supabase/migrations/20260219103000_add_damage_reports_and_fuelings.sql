-- Add missing DB objects for Damages and Fuel modules

CREATE TABLE IF NOT EXISTS public.damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  location_text text,
  latitude double precision,
  longitude double precision,
  photo_path text,
  status text NOT NULL DEFAULT 'ABERTA',
  response text,
  responded_at timestamptz,
  responded_by uuid REFERENCES public.users(id)
);

DROP TRIGGER IF EXISTS trg_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER trg_damage_reports_updated_at
BEFORE UPDATE ON public.damage_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own damage reports" ON public.damage_reports;
CREATE POLICY "Users can insert own damage reports"
ON public.damage_reports
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own damage reports" ON public.damage_reports;
CREATE POLICY "Users can read own damage reports"
ON public.damage_reports
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Coordenadores and above can read all damage reports" ON public.damage_reports;
CREATE POLICY "Coordenadores and above can read all damage reports"
ON public.damage_reports
FOR SELECT
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Coordenadores and above can update damage reports" ON public.damage_reports;
CREATE POLICY "Coordenadores and above can update damage reports"
ON public.damage_reports
FOR UPDATE
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()))
WITH CHECK (public.is_coordenador_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.fuelings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  token text NOT NULL,
  value numeric NOT NULL,
  km_hours numeric NOT NULL,
  image_url text,
  latitude double precision,
  longitude double precision
);

DROP TRIGGER IF EXISTS trg_fuelings_updated_at ON public.fuelings;
CREATE TRIGGER trg_fuelings_updated_at
BEFORE UPDATE ON public.fuelings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fuelings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own fuelings" ON public.fuelings;
CREATE POLICY "Users can insert own fuelings"
ON public.fuelings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can read own fuelings" ON public.fuelings;
CREATE POLICY "Users can read own fuelings"
ON public.fuelings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Coordenadores and above can read all fuelings" ON public.fuelings;
CREATE POLICY "Coordenadores and above can read all fuelings"
ON public.fuelings
FOR SELECT
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-reports', 'damage-reports', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fuelings', 'fuelings', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own damage photos" ON storage.objects;
CREATE POLICY "Users can upload own damage photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'damage-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own damage photos" ON storage.objects;
CREATE POLICY "Users can update own damage photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'damage-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'damage-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own damage photos" ON storage.objects;
CREATE POLICY "Users can delete own damage photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'damage-reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload fueling photos" ON storage.objects;
CREATE POLICY "Users can upload fueling photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fuelings');

DROP POLICY IF EXISTS "Users can update fueling photos" ON storage.objects;
CREATE POLICY "Users can update fueling photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fuelings')
WITH CHECK (bucket_id = 'fuelings');

DROP POLICY IF EXISTS "Users can delete fueling photos" ON storage.objects;
CREATE POLICY "Users can delete fueling photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fuelings');

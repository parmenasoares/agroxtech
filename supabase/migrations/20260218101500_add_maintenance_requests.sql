-- Maintenance requests opened by operators and answered by mechanics/coordinators

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_description text NOT NULL,
  location_text text,
  latitude double precision,
  longitude double precision,
  photo_path text,
  status text NOT NULL DEFAULT 'ABERTA',
  mechanic_response text,
  responded_at timestamptz,
  responded_by uuid REFERENCES public.users(id)
);

DROP TRIGGER IF EXISTS trg_maintenance_requests_updated_at ON public.maintenance_requests;
CREATE TRIGGER trg_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users can insert own maintenance requests"
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Users can read own maintenance requests"
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Coordenadores and above can read all maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Coordenadores and above can read all maintenance requests"
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Coordenadores and above can update maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Coordenadores and above can update maintenance requests"
ON public.maintenance_requests
FOR UPDATE
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()))
WITH CHECK (public.is_coordenador_or_above(auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-requests', 'maintenance-requests', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own maintenance photos" ON storage.objects;
CREATE POLICY "Users can upload own maintenance photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own maintenance photos" ON storage.objects;
CREATE POLICY "Users can update own maintenance photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'maintenance-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'maintenance-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own maintenance photos" ON storage.objects;
CREATE POLICY "Users can delete own maintenance photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Orders module: simple operator requests + status tracking

CREATE TABLE IF NOT EXISTS public.order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('Folga', 'Ferias', 'Ferramenta', 'Outros')),
  details text,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REPROVADO')),
  review_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_requests' AND policyname = 'Users can insert own order requests'
  ) THEN
    CREATE POLICY "Users can insert own order requests"
    ON public.order_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_requests' AND policyname = 'Users can view own order requests'
  ) THEN
    CREATE POLICY "Users can view own order requests"
    ON public.order_requests
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_requests' AND policyname = 'Admins can view all order requests'
  ) THEN
    CREATE POLICY "Admins can view all order requests"
    ON public.order_requests
    FOR SELECT
    USING (public.is_admin_or_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_requests' AND policyname = 'Admins can update order requests'
  ) THEN
    CREATE POLICY "Admins can update order requests"
    ON public.order_requests
    FOR UPDATE
    USING (public.is_admin_or_super_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_super_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_requests_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_requests_updated_at ON public.order_requests;
CREATE TRIGGER trg_order_requests_updated_at
BEFORE UPDATE ON public.order_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_order_requests_updated_at();

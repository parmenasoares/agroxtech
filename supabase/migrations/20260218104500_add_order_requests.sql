-- Simple requests module: time off, vacation, tools, others

CREATE TABLE IF NOT EXISTS public.order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  decision_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id),
  CONSTRAINT order_requests_request_type_check CHECK (request_type IN ('FOLGA', 'FERIAS', 'FERRAMENTA', 'OUTROS')),
  CONSTRAINT order_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

DROP TRIGGER IF EXISTS trg_order_requests_updated_at ON public.order_requests;
CREATE TRIGGER trg_order_requests_updated_at
BEFORE UPDATE ON public.order_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own order requests" ON public.order_requests;
CREATE POLICY "Users can insert own order requests"
ON public.order_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own order requests" ON public.order_requests;
CREATE POLICY "Users can read own order requests"
ON public.order_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Coordenadores and above can read all order requests" ON public.order_requests;
CREATE POLICY "Coordenadores and above can read all order requests"
ON public.order_requests
FOR SELECT
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Coordenadores and above can update order requests" ON public.order_requests;
CREATE POLICY "Coordenadores and above can update order requests"
ON public.order_requests
FOR UPDATE
TO authenticated
USING (public.is_coordenador_or_above(auth.uid()))
WITH CHECK (public.is_coordenador_or_above(auth.uid()));

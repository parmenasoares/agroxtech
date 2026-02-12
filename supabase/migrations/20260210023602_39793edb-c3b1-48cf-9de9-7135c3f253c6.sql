-- Compliance / documentos do utilizador (KYC)

-- Enum para status de aprovação
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE public.verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- Enum para tipos de documento
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE public.document_type AS ENUM (
      'CC',
      'PASSPORT',
      'RESIDENCE_TITLE',
      'AIMA_APPOINTMENT_PROOF',
      'NISS_PROOF',
      'NIF_PROOF',
      'IBAN_PROOF',
      'ADDRESS_PROOF'
    );
  END IF;
END $$;

-- Dados textuais (NIF/NISS/IBAN/morada etc.)
CREATE TABLE IF NOT EXISTS public.user_compliance (
  user_id uuid PRIMARY KEY,
  nif text NULL,
  niss text NULL,
  iban text NULL,
  address_line1 text NULL,
  address_line2 text NULL,
  postal_code text NULL,
  city text NULL,
  country text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estado de aprovação e auditoria
CREATE TABLE IF NOT EXISTS public.user_verifications (
  user_id uuid PRIMARY KEY,
  status public.verification_status NOT NULL DEFAULT 'PENDING',
  submitted_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL,
  review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_verifications_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);

-- Metadados dos ficheiros (o ficheiro em si fica no storage)
CREATE TABLE IF NOT EXISTS public.user_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type public.document_type NOT NULL,
  storage_path text NOT NULL,
  file_name text NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_document_files_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_document_files_unique_per_type
  ON public.user_document_files (user_id, doc_type);

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_user_compliance_updated_at ON public.user_compliance;
CREATE TRIGGER trg_user_compliance_updated_at
BEFORE UPDATE ON public.user_compliance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_verifications_updated_at ON public.user_verifications;
CREATE TRIGGER trg_user_verifications_updated_at
BEFORE UPDATE ON public.user_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.user_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_document_files ENABLE ROW LEVEL SECURITY;

-- Políticas: user_compliance
DROP POLICY IF EXISTS "Users can view own compliance" ON public.user_compliance;
CREATE POLICY "Users can view own compliance"
ON public.user_compliance
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own compliance" ON public.user_compliance;
CREATE POLICY "Users can upsert own compliance"
ON public.user_compliance
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Coordenadores can view all compliance" ON public.user_compliance;
CREATE POLICY "Coordenadores can view all compliance"
ON public.user_compliance
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

-- Políticas: user_verifications
DROP POLICY IF EXISTS "Users can view own verification" ON public.user_verifications;
CREATE POLICY "Users can view own verification"
ON public.user_verifications
FOR SELECT
USING (user_id = auth.uid());

-- User pode criar/atualizar o próprio registo (submeter)
DROP POLICY IF EXISTS "Users can upsert own verification" ON public.user_verifications;
CREATE POLICY "Users can upsert own verification"
ON public.user_verifications
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own verification status fields" ON public.user_verifications;
CREATE POLICY "Users can update own verification status fields"
ON public.user_verifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Coordenadores/Admins podem ver e rever
DROP POLICY IF EXISTS "Coordenadores can view all verifications" ON public.user_verifications;
CREATE POLICY "Coordenadores can view all verifications"
ON public.user_verifications
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

DROP POLICY IF EXISTS "Coordenadores can review verifications" ON public.user_verifications;
CREATE POLICY "Coordenadores can review verifications"
ON public.user_verifications
FOR UPDATE
USING (public.is_coordenador_or_above(auth.uid()))
WITH CHECK (public.is_coordenador_or_above(auth.uid()));

-- Políticas: user_document_files
DROP POLICY IF EXISTS "Users can view own document metadata" ON public.user_document_files;
CREATE POLICY "Users can view own document metadata"
ON public.user_document_files
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own document metadata" ON public.user_document_files;
CREATE POLICY "Users can insert own document metadata"
ON public.user_document_files
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own document metadata" ON public.user_document_files;
CREATE POLICY "Users can update own document metadata"
ON public.user_document_files
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Coordenadores can view all document metadata" ON public.user_document_files;
CREATE POLICY "Coordenadores can view all document metadata"
ON public.user_document_files
FOR SELECT
USING (public.is_coordenador_or_above(auth.uid()));

-- Bucket privado para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (sem criar nada no schema storage além de policies)
-- Regras de naming: userId/...
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'user-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_coordenador_or_above(auth.uid())
  )
);

DROP POLICY IF EXISTS "Coordenadores can delete documents" ON storage.objects;
CREATE POLICY "Coordenadores can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'user-documents'
  AND public.is_coordenador_or_above(auth.uid())
);

-- Função helper: garantir linhas base ao autenticar
CREATE OR REPLACE FUNCTION public.ensure_user_compliance_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.user_compliance (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_verifications (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
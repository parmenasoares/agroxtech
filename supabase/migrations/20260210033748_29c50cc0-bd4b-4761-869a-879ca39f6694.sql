-- Add encrypted + masked fields for PII (NIF/NISS/IBAN)
-- We keep legacy plaintext columns temporarily for migration, but the app will stop reading/writing them.

ALTER TABLE public.user_compliance
  ADD COLUMN IF NOT EXISTS nif_enc bytea,
  ADD COLUMN IF NOT EXISTS niss_enc bytea,
  ADD COLUMN IF NOT EXISTS iban_enc bytea,
  ADD COLUMN IF NOT EXISTS nif_last4 text,
  ADD COLUMN IF NOT EXISTS niss_last4 text,
  ADD COLUMN IF NOT EXISTS iban_last4 text;

-- Basic sanity constraints for masked fields (no time-based checks)
ALTER TABLE public.user_compliance
  ADD CONSTRAINT user_compliance_nif_last4_len CHECK (nif_last4 IS NULL OR length(nif_last4) <= 4),
  ADD CONSTRAINT user_compliance_niss_last4_len CHECK (niss_last4 IS NULL OR length(niss_last4) <= 4),
  ADD CONSTRAINT user_compliance_iban_last4_len CHECK (iban_last4 IS NULL OR length(iban_last4) <= 4);

-- Helpful indexes for admin/coordinator listing views (optional)
CREATE INDEX IF NOT EXISTS idx_user_compliance_user_id ON public.user_compliance(user_id);
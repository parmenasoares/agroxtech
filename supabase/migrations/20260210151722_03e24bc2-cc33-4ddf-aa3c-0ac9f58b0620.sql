-- Relax insert/update permissions on activities: any authenticated user can create and finish their own activities
-- Keep admin/coordinator abilities intact.

DO $$
BEGIN
  -- Drop old policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Operators can insert activities') THEN
    EXECUTE 'DROP POLICY "Operators can insert activities" ON public.activities';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Operators can update pending activities') THEN
    EXECUTE 'DROP POLICY "Operators can update pending activities" ON public.activities';
  END IF;
END $$;

-- Any authenticated user can insert an activity for themselves
CREATE POLICY "Authenticated users can insert own activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (operator_id = auth.uid());

-- Any authenticated user can update their own activity while it is pending validation
CREATE POLICY "Authenticated users can update own pending activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (operator_id = auth.uid() AND status = 'PENDING_VALIDATION')
WITH CHECK (operator_id = auth.uid() AND status = 'PENDING_VALIDATION');

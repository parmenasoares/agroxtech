-- Allow users to delete their own files in private bucket user-documents (so they can replace uploads)
-- Keep existing coordinator+ delete policy intact.

DO $$ BEGIN
  -- storage.objects is managed; we only add policies.
END $$;

-- Users can delete objects under their own folder: {auth.uid()}/...
CREATE POLICY "Users can delete own user-documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own document metadata rows (optional but recommended for clean removal)
CREATE POLICY "Users can delete own document metadata"
ON public.user_document_files
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_coordenador_or_above(auth.uid())
);

-- Create private bucket for activity photos
insert into storage.buckets (id, name, public)
values ('activity-photos', 'activity-photos', false)
on conflict (id) do nothing;

-- RLS policies for activity photos bucket
-- Note: policies live on storage.objects (Supabase-managed table)

-- Allow operators (and any authenticated user) to upload into their own folder: {uid}/...
create policy "Users can upload own activity photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'activity-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own uploaded photos
create policy "Users can read own activity photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'activity-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow privileged roles to read all activity photos (for validation/audit)
create policy "Coordenadores and above can read all activity photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'activity-photos'
  and public.is_coordenador_or_above(auth.uid())
);

-- Allow users to update metadata / replace their own photos
create policy "Users can update own activity photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'activity-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'activity-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own photos
create policy "Users can delete own activity photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'activity-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

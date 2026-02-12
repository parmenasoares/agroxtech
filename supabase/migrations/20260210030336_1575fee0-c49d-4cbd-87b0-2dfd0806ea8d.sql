ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS start_odometer_photo_url text NULL,
  ADD COLUMN IF NOT EXISTS end_odometer_photo_url text NULL;
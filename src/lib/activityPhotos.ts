import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export class ActivityPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityPhotoError";
  }
}

function assertValidImage(blob: Blob) {
  if (!blob) throw new ActivityPhotoError("Missing image");

  // Some browsers may provide an empty string for blob.type; treat as invalid.
  if (!blob.type || !blob.type.startsWith("image/")) {
    throw new ActivityPhotoError("Invalid image type");
  }

  if (blob.size <= 0) {
    throw new ActivityPhotoError("Empty image");
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new ActivityPhotoError("Image too large (max 5MB)");
  }
}

export async function uploadActivityPhoto(params: {
  userId: string;
  blob: Blob;
  prefix: "start" | "end" | "start-odometer" | "end-odometer";
}): Promise<string> {
  const { userId, blob, prefix } = params;

  assertValidImage(blob);

  const ext = blob.type === "image/png" ? "png" : "jpg";

  // Path layout: {uid}/{uuid}-{prefix}.jpg
  // Using uid as first folder enables RLS rules on storage.objects.
  const filePath = `${userId}/${crypto.randomUUID()}-${prefix}.${ext}`;

  const { data, error } = await supabase.storage
    .from("activity-photos")
    .upload(filePath, blob, {
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data?.path) {
    throw new ActivityPhotoError(error?.message || "Failed to upload photo");
  }

  return data.path;
}

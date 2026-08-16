import { getSupabase } from "./client";

export type BucketName =
  | "avatars"
  | "course-files"
  | "submission-files"
  | "certificates"
  | "enia-media"
  | "public-media";

export async function uploadFile(bucket: BucketName, path: string, file: File) {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return data;
}

export async function getPublicUrl(bucket: BucketName, path: string) {
  const sb = getSupabase();
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function createSignedUrl(bucket: BucketName, path: string, expiresIn = 60 * 10) {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFile(bucket: BucketName, path: string) {
  const sb = getSupabase();
  const { error } = await sb.storage.from(bucket).remove([path]);
  if (error) throw error;
}

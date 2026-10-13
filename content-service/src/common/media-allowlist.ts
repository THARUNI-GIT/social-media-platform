import { BadRequestException } from '@nestjs/common';

/**
 * Post `mediaUrls` come from the client, so they must point inside our own object-storage bucket.
 * Without this check a caller can store any URL (phishing, tracking, spoofed avatars) in a post
 * that the platform then renders as its own content.
 *
 * When the platform URL/bucket is not configured the check is skipped, which keeps unit tests and
 * non-media deployments working exactly as before.
 */
export function isAllowedMediaUrl(url: unknown, publicUrl?: string, bucket?: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (!publicUrl || !bucket) return true; // allowlist not configured
  if (url.includes('..')) return false;
  const base = `${publicUrl.replace(/\/+$/, '')}/${bucket}/`;
  return url.startsWith(base);
}

/** Throws 400 INVALID_MEDIA_URL when any entry is outside the platform bucket. */
export function assertMediaUrls(urls: unknown, publicUrl = process.env.MINIO_PUBLIC_URL, bucket = process.env.MINIO_BUCKET): void {
  const list = Array.isArray(urls) ? urls : [];
  for (const url of list) {
    if (!isAllowedMediaUrl(url, publicUrl, bucket)) {
      throw new BadRequestException({ code: 'INVALID_MEDIA_URL', message: 'Media URLs must point at the platform media bucket' });
    }
  }
}

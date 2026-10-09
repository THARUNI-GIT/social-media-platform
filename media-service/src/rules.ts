import { BadRequestException } from '@nestjs/common';
export type Kind = 'avatar' | 'post';
export const LIMITS: Record<Kind, { maxBytes: number; types: Record<string, string> }> = {
  avatar: { maxBytes: 2 * 1024 * 1024, types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } },
  post: { maxBytes: 8 * 1024 * 1024, types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } },
};
const bad = (code: string, message: string) => new BadRequestException({ code, message });
/** Returns the file extension for a valid request or throws. */
export function validateUpload(kind: Kind, contentType: string, size: number): string {
  const l = LIMITS[kind]; if (!l) throw bad('INVALID_KIND', 'kind must be avatar or post');
  const ext = l.types[contentType]; if (!ext) throw bad('INVALID_TYPE', `Allowed types: ${Object.keys(l.types).join(', ')}`);
  if (!Number.isFinite(size) || size <= 0) throw bad('INVALID_SIZE', 'size must be a positive number');
  if (size > l.maxBytes) throw bad('FILE_TOO_LARGE', `Max ${Math.floor(l.maxBytes / 1024 / 1024)}MB for ${kind}`);
  return ext;
}
export const objectKey = (kind: Kind, userId: string, id: string, ext: string) => `${kind}/${userId}/${id}.${ext}`;
/** A delete may only target the caller's own folder. */
export const ownsKey = (key: string, userId: string) => /^(avatar|post)\/[^/]+\/[^/]+$/.test(key) && key.split('/')[1] === userId && !key.includes('..');

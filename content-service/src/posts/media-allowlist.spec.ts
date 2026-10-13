import { assertMediaUrls, isAllowedMediaUrl } from '../common/media-allowlist';

describe('media URL allowlist', () => {
  const pub = 'http://localhost:9000';
  const bucket = 'socialpulse-media';
  const good = 'http://localhost:9000/socialpulse-media/post/u1/x.png';

  it('accepts URLs inside the platform bucket', () => {
    expect(isAllowedMediaUrl(good, pub, bucket)).toBe(true);
    expect(isAllowedMediaUrl(`${pub}/${bucket}/avatar/u1/a.webp`, pub, bucket)).toBe(true);
  });

  it('rejects external hosts, other buckets and traversal', () => {
    expect(isAllowedMediaUrl('https://evil.example/x.png', pub, bucket)).toBe(false);
    expect(isAllowedMediaUrl('http://localhost:9000/other-bucket/x.png', pub, bucket)).toBe(false);
    expect(isAllowedMediaUrl(`${pub}/${bucket}/../../etc/passwd`, pub, bucket)).toBe(false);
    expect(isAllowedMediaUrl(`${pub}/${bucket}evil/x.png`, pub, bucket)).toBe(false); // prefix trick
  });

  it('rejects non-strings and empty values', () => {
    expect(isAllowedMediaUrl(undefined, pub, bucket)).toBe(false);
    expect(isAllowedMediaUrl('', pub, bucket)).toBe(false);
    expect(isAllowedMediaUrl(42, pub, bucket)).toBe(false);
  });

  it('is skipped when the allowlist is not configured', () => {
    expect(isAllowedMediaUrl('https://anywhere.example/x.png', undefined, undefined)).toBe(true);
  });

  it('assertMediaUrls throws 400 for a foreign URL and passes for ours', () => {
    expect(() => assertMediaUrls([good], pub, bucket)).not.toThrow();
    expect(() => assertMediaUrls([], pub, bucket)).not.toThrow();
    expect(() => assertMediaUrls(['https://evil.example/x.png'], pub, bucket)).toThrowError(/bucket/i);
  });
});

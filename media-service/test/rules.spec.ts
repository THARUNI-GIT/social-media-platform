import { objectKey, ownsKey, validateUpload } from '../src/rules';
describe('media rules', () => {
  it('accepts valid uploads and returns extension', () => { expect(validateUpload('avatar', 'image/png', 1000)).toBe('png'); expect(validateUpload('post', 'image/gif', 5e6)).toBe('gif'); });
  it('rejects bad type, oversize, bad size', () => {
    expect(() => validateUpload('avatar', 'image/gif', 1000)).toThrow(); expect(() => validateUpload('avatar', 'image/png', 3 * 1024 * 1024)).toThrow();
    expect(() => validateUpload('post', 'application/pdf', 10)).toThrow(); expect(() => validateUpload('post', 'image/png', 0)).toThrow();
  });
  it('only lets owners delete their own keys', () => {
    const k = objectKey('post', 'u1', 'abc', 'png'); expect(k).toBe('post/u1/abc.png');
    expect(ownsKey(k, 'u1')).toBe(true); expect(ownsKey(k, 'u2')).toBe(false); expect(ownsKey('post/u1/../u2/x.png', 'u1')).toBe(false);
  });
});

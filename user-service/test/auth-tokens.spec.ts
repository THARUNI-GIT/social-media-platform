import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { hashToken, newRefreshToken, normalizeHandle, signAccess } from '../src/auth/tokens';
import { toPage } from '../src/common/pagination';
describe('user-service core logic', () => {
  it('hashes refresh tokens deterministically and never stores raw', () => {
    const t = newRefreshToken(); expect(hashToken(t)).toBe(hashToken(t)); expect(hashToken(t)).not.toContain(t); expect(newRefreshToken()).not.toBe(t);
  });
  it('normalizes handles', () => expect(normalizeHandle(' @Jane_Doe ')).toBe('jane_doe'));
  it('signs RS256 access tokens with sub + roles that the public key verifies', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
    const p: any = jwt.verify(signAccess('u1', ['user']), publicKey, { algorithms: ['RS256'] });
    expect(p.sub).toBe('u1'); expect(p.roles).toEqual(['user']); expect(p.exp - p.iat).toBe(900);
  });
  it('toPage returns nextCursor only when more rows exist', () => {
    expect(toPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2)).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c' });
    expect(toPage([{ id: 'a' }], 2).nextCursor).toBeNull();
  });
});

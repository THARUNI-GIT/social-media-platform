import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { bearer, isPublic, needsAdmin, trustedHeaders, verify } from '../src/auth';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
describe('gateway auth', () => {
  it('verifies good tokens and rejects bad/expired ones', () => {
    const ok = jwt.sign({ roles: ['admin'] }, privateKey, { algorithm: 'RS256', subject: 'u1' });
    expect(verify(ok, publicKey)).toEqual({ userId: 'u1', roles: ['admin'] });
    expect(verify('x.y.z', publicKey)).toBeNull();
    expect(verify(jwt.sign({}, privateKey, { algorithm: 'RS256', subject: 'u1', expiresIn: -10 }), publicKey)).toBeNull();
  });
  it('strips spoofed identity headers and injects trusted ones', () => {
    const h = trustedHeaders({ 'x-user-id': 'evil', 'x-user-roles': 'admin', accept: '*/*' }, null);
    expect(h['x-user-id']).toBeUndefined(); expect(h['x-user-roles']).toBeUndefined(); expect(h.accept).toBe('*/*');
    expect(trustedHeaders({ 'x-user-id': 'evil' }, { userId: 'u1', roles: ['user', 'admin'] })).toMatchObject({ 'x-user-id': 'u1', 'x-user-roles': 'user,admin' });
  });
  it('knows public routes', () => {
    expect(isPublic('POST', '/auth/login')).toBe(true); expect(isPublic('GET', '/posts')).toBe(false);
    expect(isPublic('GET', '/users/11111111-1111-1111-1111-111111111111')).toBe(true); expect(isPublic('GET', '/users/me')).toBe(false);
  });
  it('parses bearer', () => { expect(bearer('Bearer abc')).toBe('abc'); expect(bearer('Basic abc')).toBeNull(); });
  it('flags admin routes', () => { expect(needsAdmin('/admin/reports?x=1')).toBe(true); expect(needsAdmin('/administrator')).toBe(false); });
});

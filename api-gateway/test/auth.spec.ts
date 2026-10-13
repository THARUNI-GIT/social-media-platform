import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { bearer, isInternalOnly, isKnownRoute, isPublic, needsAdmin, parseTrustProxy, trustedHeaders, verify } from '../src/auth';
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
  it('drops the Expect header so the proxy client does not throw', () => {
    expect(trustedHeaders({ expect: '100-continue', accept: '*/*' }, null)).toEqual({ accept: '*/*' });
    expect(trustedHeaders({ expect: '100-continue' }, { userId: 'u1', roles: [] }).expect).toBeUndefined();
  });
  it('knows public routes', () => {
    expect(isPublic('POST', '/auth/login')).toBe(true); expect(isPublic('GET', '/posts')).toBe(false);
    expect(isPublic('GET', '/users/11111111-1111-1111-1111-111111111111')).toBe(true); expect(isPublic('GET', '/users/me')).toBe(false);
  });
  it('parses bearer', () => { expect(bearer('Bearer abc')).toBe('abc'); expect(bearer('Basic abc')).toBeNull(); });
  it('flags admin routes', () => { expect(needsAdmin('/admin/reports?x=1')).toBe(true); expect(needsAdmin('/administrator')).toBe(false); });
  it('flags admin routes written with encoding, extra slashes or other case', () => {
    for (const u of ['/%61dmin/users', '//admin/users', '/ADMIN/users', '/admin%2Fusers', '/admin/']) expect(needsAdmin(u)).toBe(true);
    expect(needsAdmin('/administrator')).toBe(false);
  });
  it('keeps public-route matching strict (encoded variants are not public)', () => {
    expect(isPublic('POST', '/%61uth/login')).toBe(false); expect(isPublic('POST', '//auth/login')).toBe(false);
  });
  it('blocks the internal batch route however it is written', () => {
    for (const u of ['/users/batch', '/users/batch/', '/users/%62atch', '/users/batch?x=1', '//users/batch']) expect(isInternalOnly(u)).toBe(true);
    for (const u of ['/users/me', '/users/batchfoo', '/users/11111111-1111-1111-1111-111111111111']) expect(isInternalOnly(u)).toBe(false);
  });
  it('parses TRUST_PROXY safely (off by default)', () => {
    expect(parseTrustProxy(undefined)).toBe(false); expect(parseTrustProxy('false')).toBe(false); expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('1')).toBe(1); expect(parseTrustProxy('nonsense')).toBe(false); expect(parseTrustProxy('-3')).toBe(false);
  });
  it('knows which routes exist, so unknown paths get 404 instead of a misleading 401', () => {
    for (const u of ['/auth/login', '/users', '/users/me', '/posts', '/conversations/abc/messages', '/notifications/socket.io/?EIO=4&transport=polling', '/media/uploads', '/admin/reports', '/health', '/socket.io/?EIO=4', '//admin']) expect(isKnownRoute(u)).toBe(true);
    for (const u of ['/nope', '/api/docs', '/usersx', '/favicon.ico', '/administrator']) expect(isKnownRoute(u)).toBe(false);
  });
});
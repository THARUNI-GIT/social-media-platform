import * as jwt from 'jsonwebtoken';
export interface Identity { userId: string; roles: string[] }
const pem = (v?: string) => (v ?? '').replace(/\\n/g, '\n');
export const bearer = (h?: string) => { const m = /^Bearer\s+(.+)$/i.exec(h ?? ''); return m ? m[1] : null; };
/** Verify RS256/ES256 token; returns null when invalid/expired. */
export function verify(token: string, publicKey = process.env.JWT_PUBLIC_KEY): Identity | null {
  try {
    const p: any = jwt.verify(token, pem(publicKey), { algorithms: ['RS256', 'ES256'] });
    const id = p.sub ?? p.userId ?? p.id; if (!id) return null;
    return { userId: String(id), roles: Array.isArray(p.roles) ? p.roles.map(String) : [] };
  } catch { return null; }
}
/** Public (no token needed). Everything else requires a valid bearer. */
export const isPublic = (method: string, url: string) => {
  const path = url.split('?')[0];
  return path === '/health' || path.startsWith('/socket.io') || path.startsWith('/notifications/socket.io') || /^\/auth\/(register|login|refresh|logout)$/.test(path)
    || (method === 'GET' && /^\/users\/[0-9a-f-]{36}(\/followers|\/following)?$/i.test(path)); // optional-viewer profile reads
};
const INTERNAL = ['x-user-id', 'x-user-roles'];
/** Never forwarded upstream: undici throws NotSupportedError on `expect`, which turns clients that send `Expect: 100-continue` into a 500. */
const NOT_FORWARDED = ['expect'];
/** Always drop client-supplied identity headers; inject trusted ones only for verified users. */
export function trustedHeaders(incoming: Record<string, any>, id: Identity | null) {
  const out = { ...incoming }; for (const k of [...INTERNAL, ...NOT_FORWARDED]) delete out[k];
  if (id) { out['x-user-id'] = id.userId; out['x-user-roles'] = id.roles.join(','); }
  return out;
}
export const parseOrigins = (v?: string) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
/**
 * Fastify routes on the decoded path, so deny rules must look at the decoded, slash-collapsed path too
 * (otherwise `/%61dmin/users` skips the admin check but still reaches the admin route).
 * Allow rules (isPublic) deliberately keep matching the raw URL, so odd encodings fail closed.
 */
export const canonicalPath = (url: string) => {
  let p = url.split('?')[0];
  try { p = decodeURIComponent(p); } catch { /* malformed escape: keep raw */ }
  return p.replace(/\/{2,}/g, '/');
};
/** /admin/* needs role "admin" (services re-check; defence in depth). */
export const needsAdmin = (url: string) => /^\/admin(\/|$)/i.test(canonicalPath(url));
/** Service-to-service routes that must never be reachable through the gateway. */
export const isInternalOnly = (url: string) => /^\/users\/batch\/?$/i.test(canonicalPath(url));
const KNOWN_PREFIXES = ['/auth', '/users', '/posts', '/conversations', '/notifications', '/media', '/admin', '/health', '/socket.io'];
/** Prefixes this gateway actually routes. Anything else is answered with a plain 404 *before*
 *  auth runs, so probing `/whatever` no longer returns a misleading 401. */
export const isKnownRoute = (url: string) => {
  const p = canonicalPath(url);
  return KNOWN_PREFIXES.some((k) => p === k || p.startsWith(`${k}/`));
};
/** TRUST_PROXY: unset/"false" -> off (default); "true" -> trust all; "<n>" -> trust n proxy hops. Only enable behind a real reverse proxy. */
export const parseTrustProxy = (v?: string): boolean | number => {
  if (!v || v === 'false') return false; if (v === 'true') return true;
  const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 ? n : false;
};
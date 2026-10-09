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
/** Always drop client-supplied identity headers; inject trusted ones only for verified users. */
export function trustedHeaders(incoming: Record<string, any>, id: Identity | null) {
  const out = { ...incoming }; for (const k of INTERNAL) delete out[k];
  if (id) { out['x-user-id'] = id.userId; out['x-user-roles'] = id.roles.join(','); }
  return out;
}
export const parseOrigins = (v?: string) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
/** /admin/* needs role "admin" (services re-check; defence in depth). */
export const needsAdmin = (url: string) => /^\/admin(\/|$)/.test(url.split('?')[0]);

import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
const pem = (v?: string) => (v ?? '').replace(/\\n/g, '\n');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newRefreshToken = () => randomBytes(48).toString('base64url');
export const normalizeHandle = (h: string) => h.trim().replace(/^@/, '').toLowerCase();
export const accessTtl = () => parseInt(process.env.ACCESS_TTL_SECONDS ?? '900', 10);
export function signAccess(userId: string, roles: string[]) {
  return jwt.sign({ roles }, pem(process.env.JWT_PRIVATE_KEY), { algorithm: 'RS256', subject: userId, expiresIn: accessTtl(), issuer: process.env.JWT_ISSUER ?? 'socialpulse' });
}

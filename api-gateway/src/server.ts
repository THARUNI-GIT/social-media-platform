import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import { randomUUID } from 'crypto';
import { bearer, isPublic, needsAdmin, parseOrigins, trustedHeaders, verify, Identity } from './auth';

const env = (k: string, d: string) => process.env[k] ?? d;
const app = Fastify({ logger: { level: 'info' }, genReqId: (req) => String(req.headers['x-request-id'] ?? randomUUID()), trustProxy: true });
const fail = (code: string, message: string) => ({ success: false, error: { code, message } });

async function main() {
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  await app.register(cors, { origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true });
  await app.register(rateLimit, {
    global: true, max: +env('RATE_LIMIT_MAX', '300'), timeWindow: '1 minute',
    keyGenerator: (req) => (req as any).identity?.userId ?? req.ip,
    errorResponseBuilder: () => ({ ...fail('RATE_LIMITED', 'Too many requests'), statusCode: 429 }),
  });

  app.get('/health', async () => ({ success: true, data: { status: 'ok' } }));

  // Auth + identity for every request (HTTP and the Socket.IO polling/upgrade, which the chat-service verifies itself).
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    const t = bearer(req.headers.authorization); let id: Identity | null = null;
    if (t) { id = verify(t); if (!id) return reply.code(401).send(fail('UNAUTHORIZED', 'Invalid or expired token')); }
    if (!id && !isPublic(req.method, req.url)) return reply.code(401).send(fail('UNAUTHORIZED', 'Authentication required'));
    if (needsAdmin(req.url) && !id?.roles.includes('admin')) return reply.code(403).send(fail('FORBIDDEN', 'Admin only'));
    (req as any).identity = id;
  });

  const rewrite = (req: any, headers: any) => {
  const outgoing = trustedHeaders(headers, req.identity ?? null);
  delete outgoing.expect;
  return outgoing;
};
  const route = (prefix: string, upstream: string, extra: object = {}) =>
    app.register(proxy, { upstream, prefix, rewritePrefix: prefix, replyOptions: { rewriteRequestHeaders: rewrite }, ...extra });

  // Stricter limit on /auth (brute-force protection): scoped plugin with its own rate-limit config.
  await app.register(async (s) => {
    await s.register(rateLimit, { max: +env('AUTH_RATE_LIMIT_MAX', '10'), timeWindow: '1 minute', errorResponseBuilder: () => ({ ...fail('RATE_LIMITED', 'Too many attempts, slow down'), statusCode: 429 }) });
    await s.register(proxy, { upstream: env('USER_SERVICE_URL', 'http://user-service:3003'), prefix: '/auth', rewritePrefix: '/auth', replyOptions: { rewriteRequestHeaders: rewrite } });
  });
  await route('/users', env('USER_SERVICE_URL', 'http://user-service:3003'));
  await route('/posts', env('CONTENT_SERVICE_URL', 'http://content-service:3001'));
  await route('/conversations', env('CHAT_SERVICE_URL', 'http://chat-service:3002'));
  await route('/notifications', env('NOTIFICATION_SERVICE_URL', 'http://notification-service:3004'), { websocket: true }); // REST + /notifications/socket.io
  await route('/media', env('MEDIA_SERVICE_URL', 'http://media-service:3005'));
  await route('/admin/users', env('USER_SERVICE_URL', 'http://user-service:3003'));
  await route('/admin/reports', env('CONTENT_SERVICE_URL', 'http://content-service:3001'));
  // Aggregate admin dashboard numbers from the services that own the data.
  app.get('/admin/overview', async (req, reply) => {
    const id: Identity = (req as any).identity; const h = { 'x-user-id': id.userId, 'x-user-roles': id.roles.join(','), 'x-request-id': req.id };
    const get = (u: string) => fetch(u, { headers: h }).then((r) => r.json()).then((j: any) => (j.success ? j.data : null)).catch(() => null);
    const [users, content] = await Promise.all([get(`${env('USER_SERVICE_URL', 'http://user-service:3003')}/admin/users/stats`), get(`${env('CONTENT_SERVICE_URL', 'http://content-service:3001')}/admin/reports/stats`)]);
    return reply.send({ success: true, data: { users, content } });
  });
  await route('/chat', env('CHAT_SERVICE_URL', 'http://chat-service:3002'));
  // Socket.IO: websocket upgrade proxied; the chat-service verifies socket.handshake.auth.token itself.
  await route('/socket.io', env('CHAT_SERVICE_URL', 'http://chat-service:3002'), { websocket: true });

  app.setNotFoundHandler((_r, reply) => reply.code(404).send(fail('NOT_FOUND', 'Route not found')));
  await app.listen({ port: +env('PORT', '8080'), host: '0.0.0.0' });
}
main().catch((e) => { console.error(e); process.exit(1); });

// End-to-end check against a RUNNING stack (docker compose up -d). Node 20+.
// Usage (PowerShell):  node scripts/e2e.mjs            (default gateway http://localhost:8080)
//                      $env:GATEWAY="http://localhost:8081"; node scripts/e2e.mjs
// Creates throwaway users (e2e_<timestamp>_a/b/c). Exits 1 if any check fails.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const B = process.env.GATEWAY ?? 'http://localhost:8080';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stamp = Date.now();
let failed = 0, passed = 0, skipped = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (name, cond, detail = '') => { if (cond) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name} ${detail}`); } };
const skip = (name, why) => { skipped++; console.log(`SKIP  ${name} (${why})`); };

async function api(method, p, { token, body, headers = {} } = {}) {
  const res = await fetch(B + p, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json, data: json?.data };
}
const list = (d) => (Array.isArray(d) ? d : d?.items ?? d?.data ?? []);
const short = (r) => `-> ${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`;

async function register(tag) {
  const handle = `e2e_${stamp}_${tag}`;
  const r = await api('POST', '/auth/register', { body: { email: `${handle}@example.com`, password: 'password123', handle, displayName: `E2E ${tag}` } });
  ok(`register ${tag}`, r.status === 201 && r.data?.accessToken && r.data?.refreshToken, short(r));
  return { handle, token: r.data?.accessToken, refresh: r.data?.refreshToken, id: r.data?.user?.id };
}

(async () => {
  console.log(`Gateway: ${B}`);
  const health = await api('GET', '/health').catch((e) => ({ status: 0, json: { error: e.cause?.code ?? e.message } }));
  if (health.status !== 200) { console.log(`FAIL  gateway not reachable at ${B} ${short(health)} - is the stack up? (docker compose ps)`); process.exit(1); }

  // ---------- auth ----------
  console.log('\n# auth');
  const a = await register('a'), b = await register('b'), c = await register('c');
  if (!a.token || !b.token || !c.token) { console.log('Cannot continue without users (auth rate limit is 10/min per IP; wait a minute and retry).'); process.exit(1); }
  const login = await api('POST', '/auth/login', { body: { identifier: a.handle, password: 'password123' } });
  ok('login with handle', login.status === 200 && login.data?.accessToken, short(login));
  ok('wrong password -> 401', (await api('POST', '/auth/login', { body: { identifier: a.handle, password: 'nope-nope' } })).status === 401);
  ok('/users/me with token', (await api('GET', '/users/me', { token: a.token })).data?.id === a.id);
  ok('/users/me without token -> 401', (await api('GET', '/users/me')).status === 401);

  const rf = await api('POST', '/auth/refresh', { body: { refreshToken: a.refresh } });
  ok('refresh returns new tokens', rf.status === 200 && rf.data?.refreshToken && rf.data.refreshToken !== a.refresh, short(rf));
  ok('reusing the OLD refresh token is rejected', (await api('POST', '/auth/refresh', { body: { refreshToken: a.refresh } })).status === 401);
  ok('reuse revoked the whole session (new refresh token now dead too)', (await api('POST', '/auth/refresh', { body: { refreshToken: rf.data?.refreshToken } })).status === 401);
  const relog = await api('POST', '/auth/login', { body: { identifier: a.handle, password: 'password123' } });
  a.token = relog.data?.accessToken; a.refresh = relog.data?.refreshToken;

  // ---------- follow + posts + feed ----------
  console.log('\n# follow, posts, feed');
  ok('B follows A', (await api('POST', `/users/${a.id}/follow`, { token: b.token })).status === 200);
  const p1 = await api('POST', '/posts', { token: a.token, body: { caption: `hello from e2e #e2e${stamp}`, visibility: 'public' } });
  ok('A creates a public post', p1.status === 201 && p1.data?.id, short(p1));
  const postId = p1.data?.id;
  const pf = await api('POST', '/posts', { token: a.token, body: { caption: 'followers only post', visibility: 'followers' } });
  const pp = await api('POST', '/posts', { token: a.token, body: { caption: 'private post', visibility: 'private' } });
  const feedB = list((await api('GET', '/posts?limit=50', { token: b.token })).data).map((x) => x.id);
  ok('B (follower) sees the public post in the feed', feedB.includes(postId));
  ok('B (follower) sees the followers-only post', feedB.includes(pf.data?.id));
  ok('B does NOT see the private post', !feedB.includes(pp.data?.id));
  const feedC = list((await api('GET', '/posts?limit=50', { token: c.token })).data).map((x) => x.id);
  ok('C (not a follower) does NOT see the followers-only post', !feedC.includes(pf.data?.id));
  ok('C cannot fetch the followers-only post directly', [403, 404].includes((await api('GET', `/posts/${pf.data?.id}`, { token: c.token })).status));
  ok('C cannot fetch the private post directly', [403, 404].includes((await api('GET', `/posts/${pp.data?.id}`, { token: c.token })).status));
  const tag = list((await api('GET', `/posts/hashtags/e2e${stamp}`, { token: b.token })).data).map((x) => x.id);
  ok('hashtag lookup finds the post', tag.includes(postId));

  console.log('\n# interactions + cross-user protection');
  ok('B likes the post', (await api('POST', `/posts/${postId}/reactions`, { token: b.token, body: { reactionType: 'like' } })).status < 300);
  const cm = await api('POST', `/posts/${postId}/comments`, { token: b.token, body: { content: 'nice one' } });
  ok('B comments', cm.status === 201 && cm.data?.id, short(cm));
  ok('B bookmarks', (await api('POST', `/posts/${postId}/bookmark`, { token: b.token })).status < 300);
  ok('B cannot edit A\'s post -> 403', (await api('PATCH', `/posts/${postId}`, { token: b.token, body: { caption: 'hacked' } })).status === 403);
  ok('B cannot delete A\'s post -> 403', (await api('DELETE', `/posts/${postId}`, { token: b.token })).status === 403);
  ok('post still there after B\'s attempts', (await api('GET', `/posts/${postId}`, { token: a.token })).data?.caption?.startsWith('hello'));
  ok('report requires auth', (await api('POST', `/posts/${postId}/report`, { body: { reason: 'spam' } })).status === 401);
  ok('B reports the post', (await api('POST', `/posts/${postId}/report`, { token: b.token, body: { reason: 'spam' } })).status < 300);
  ok('non-admin cannot list reports', (await api('GET', '/admin/reports', { token: b.token })).status === 403);

  // ---------- notifications ----------
  console.log('\n# notifications');
  let notes = [];
  for (let i = 0; i < 10 && !notes.length; i++) { await sleep(700); notes = list((await api('GET', '/notifications', { token: a.token })).data); }
  ok('A received notifications from B\'s like/comment/follow', notes.length > 0, `(got ${notes.length}; RabbitMQ events may not be flowing)`);
  const unread = (await api('GET', '/notifications/unread-count', { token: a.token })).data?.count;
  ok('unread-count > 0', unread > 0, `(got ${unread})`);
  if (notes[0]?.id) {
    ok('B cannot mark A\'s notification as read', [403, 404].includes((await api('POST', `/notifications/${notes[0].id}/read`, { token: b.token })).status));
    ok('A marks one read', (await api('POST', `/notifications/${notes[0].id}/read`, { token: a.token })).status === 200);
  }
  ok('A read-all -> unread 0', (await api('POST', '/notifications/read-all', { token: a.token })).data?.unread === 0);

  // ---------- chat (REST + socket) ----------
  console.log('\n# chat');
  const conv = await api('POST', `/conversations/direct/${b.id}`, { token: a.token });
  const convId = conv.data?.id ?? conv.data?._id;
  ok('A opens a direct conversation with B', conv.status < 300 && convId, short(conv));
  ok('B sees it in the list', list((await api('GET', '/conversations', { token: b.token })).data).some((x) => (x.id ?? x._id) === convId));
  ok('C does not see it', !list((await api('GET', '/conversations', { token: c.token })).data).some((x) => (x.id ?? x._id) === convId));
  ok('C cannot read its messages', [403, 404].includes((await api('GET', `/conversations/${convId}/messages`, { token: c.token })).status));

  let io;
  for (const dir of [path.join(root, 'socialpulse'), path.join(root, 'chat-service'), root]) {
    try { if (existsSync(path.join(dir, 'node_modules', 'socket.io-client'))) { io = createRequire(path.join(dir, 'x.js'))('socket.io-client').io; break; } } catch { /* try next */ }
  }
  if (!io) skip('realtime chat over Socket.IO', 'socket.io-client not installed; run `npm ci` in socialpulse/');
  else {
    const connect = (token) => new Promise((resolve, reject) => { const s = io(B, { auth: { token }, transports: ['websocket'], reconnection: false }); s.on('connect', () => resolve(s)); s.on('connect_error', (e) => reject(e)); setTimeout(() => reject(new Error('timeout')), 8000); });
    try {
      const sa = await connect(a.token), sb = await connect(b.token);
      ok('both sockets connect through the gateway', true);
      const got = new Promise((res) => { sb.on('message:new', (e) => { if (e?.message?.content === 'ping-e2e') res(e.message); }); setTimeout(() => res(null), 8000); });
      sa.emit('message:send', { conversationId: convId, content: 'ping-e2e', clientTempId: 't1' });
      const msg = await got;
      ok('B receives A\'s message in real time', !!msg);
      const hist = list((await api('GET', `/conversations/${convId}/messages`, { token: b.token })).data);
      ok('message is persisted and in history', hist.some((m) => m.content === 'ping-e2e'));
      const bad = await connect(c.token).catch(() => null);
      if (bad) {
        const res = await new Promise((r) => { bad.emit('conversation:join', { conversationId: convId }, (ack) => r(ack)); setTimeout(() => r('no-ack'), 4000); });
        ok('C cannot join A and B\'s conversation room', JSON.stringify(res).match(/FORBIDDEN|error|Not a member/i) !== null, `(ack: ${JSON.stringify(res)})`);
        bad.close();
      }
      const noTok = await connect('garbage').then((s) => { s.close(); return true; }).catch(() => false);
      ok('socket with an invalid token is refused', noTok === false);
      sa.close(); sb.close();
    } catch (e) { ok('socket connection', false, `(${e.message})`); }
  }

  // ---------- media ----------
  console.log('\n# media upload');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const pre = await api('POST', '/media/uploads', { token: a.token, body: { kind: 'post', contentType: 'image/png', size: png.length } });
  ok('presign accepted', pre.status < 300 && pre.data?.uploadUrl, short(pre));
  ok('presign rejects a bad content type', (await api('POST', '/media/uploads', { token: a.token, body: { kind: 'post', contentType: 'application/x-msdownload', size: 10 } })).status === 400);
  ok('presign rejects an oversized avatar', (await api('POST', '/media/uploads', { token: a.token, body: { kind: 'avatar', contentType: 'image/png', size: 5 * 1024 * 1024 } })).status === 400);
  ok('presign requires auth', (await api('POST', '/media/uploads', { body: { kind: 'post', contentType: 'image/png', size: 10 } })).status === 401);
  if (pre.data?.uploadUrl) {
    const form = new FormData();
    for (const [k, v] of Object.entries(pre.data.fields ?? {})) form.append(k, v);
    form.append('file', new Blob([png], { type: 'image/png' }), 'dot.png'); // file part LAST
    const up = await fetch(pre.data.uploadUrl, { method: 'POST', body: form }).catch((e) => ({ status: 0, text: async () => e.message }));
    ok('direct upload to object storage succeeds', up.status >= 200 && up.status < 300, `-> ${up.status} ${(await up.text?.())?.slice(0, 160)}`);
    const get = await fetch(pre.data.publicUrl).catch(() => ({ status: 0 }));
    ok('uploaded file is readable at publicUrl', get.status === 200, `-> ${get.status} (${pre.data.publicUrl})`);
    ok('B cannot delete A\'s file', (await api('DELETE', '/media', { token: b.token, body: { key: pre.data.key } })).status === 403);
    ok('A can delete own file', (await api('DELETE', '/media', { token: a.token, body: { key: pre.data.key } })).status < 300);
  }

  // ---------- cleanup + summary ----------
  await api('DELETE', `/posts/${postId}`, { token: a.token });
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });

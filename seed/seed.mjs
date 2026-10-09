// Demo data via the public gateway API. Usage: GATEWAY=http://localhost:8080 node seed/seed.mjs  (Node 20+)
const B = process.env.GATEWAY ?? 'http://localhost:8080';
const call = async (path, { method = 'GET', token, body } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${method} ${path} -> ${r.status} ${j.error?.message ?? ''}`); return j.data;
};
const PASS = 'password123';
const people = [['admin', 'Admin'], ['alice', 'Alice Rivera'], ['bob', 'Bob Chen'], ['carol', 'Carol Singh']];
const users = {};
for (const [handle, displayName] of people) {
  try { users[handle] = await call('/auth/register', { method: 'POST', body: { email: `${handle}@demo.io`, password: PASS, handle, displayName } }); }
  catch { users[handle] = await call('/auth/login', { method: 'POST', body: { identifier: handle, password: PASS } }); }
}
const tok = (h) => users[h].accessToken, id = (h) => users[h].user.id;
const safe = async (fn) => { try { await fn(); } catch (e) { console.log('skip:', e.message); } };
for (const [a, b] of [['alice', 'bob'], ['bob', 'alice'], ['carol', 'alice'], ['alice', 'carol']]) await safe(() => call(`/users/${id(b)}/follow`, { method: 'POST', token: tok(a) }));
const posts = [['alice', 'Golden hour at the pier #sunset #goodvibes', 'public'], ['bob', 'Shipping a new side project today #coding', 'public'], ['carol', 'Friends-only update: big news soon', 'followers'], ['alice', 'Coffee first #morning', 'public']];
const made = [];
for (const [h, caption, visibility] of posts) await safe(async () => made.push(await call('/posts', { method: 'POST', token: tok(h), body: { caption, visibility } })));
if (made[0]) { await safe(() => call(`/posts/${made[0].id}/reactions`, { method: 'POST', token: tok('bob'), body: { reactionType: 'like' } })); await safe(() => call(`/posts/${made[0].id}/comments`, { method: 'POST', token: tok('carol'), body: { content: 'Gorgeous!' } })); }
await safe(() => call(`/conversations/direct/${id('bob')}`, { method: 'POST', token: tok('alice') }));
await safe(() => call(`/conversations/direct/${id('carol')}`, { method: 'POST', token: tok('alice') }));
console.log('Seeded. Logins (password "password123"): admin, alice, bob, carol');

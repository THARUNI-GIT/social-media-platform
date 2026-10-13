# QA Report — SocialPulse

**Date:** 2026-10-12 · **Branch:** `main` @ `8f933cd` · **Method:** run the real stack and exercise it (not a code read)

> **UPDATE 2026-10-13 — every bug in this report is now fixed.**
>
> | # | Bug | Status | Fix |
> |---|---|---|---|
> | 1 | Frontend login was a mock (no real auth) | ✅ fixed | `AuthContext.jsx` calls the real `authService`; boot validates via `auth.me()` |
> | 2 | AMQP consumers gave up on cold start | ✅ fixed | new `src/common/amqp-consumer.ts` (`RetryingConsumer`: capped exponential backoff + jitter, reconnect on `close`) in content / chat / notification services |
> | 3 | `compose down` wiped all data | ✅ fixed | named volumes `postgres_data` / `mongo_data` / `redis_data` |
> | 4 | Gateway permanently "unhealthy" | ✅ fixed | healthcheck hits `127.0.0.1` (BusyBox resolves `localhost` to `::1`) |
> | 5 | WebSocket handlers never acked | ✅ fixed | `run()` returns `{ ok, code, message }`, so Nest always replies |
> | 6 | Ports hardcoded in three places | ✅ fixed | `GATEWAY_PORT` / `PUBLIC_API_URL` env vars in compose + `.env.example` |
> | 7 | Stray JSON probe files with passwords not ignored | ✅ fixed | `.gitignore` covers them |
> | 8 | Stale docs; UUID chat titles; raw-UUID admin targets | ✅ fixed | docs refreshed; chat resolves participant names + people search; admin shows post captions |
>
> **Verified after the fixes:** cold `docker compose up -d --build` with **no manual restarts** →
> all 3 queues consuming, gateway `healthy`; `docker compose down` + `up` keeps all data (7 users /
> 7 posts / 5 follows intact, alice still logs in); `scripts/e2e.mjs` **50/50 pass, exit 0**;
> 36/36 unit tests; `vite build` clean; browser walkthrough of login (wrong password → 401, correct
> → feed), feed, notifications, chat (search → send → realtime), admin (stats, caption preview,
> Remove → post returns 404 and the report closes).
>
> The sections below are kept as the original findings/evidence.

---

## How I ran it

This machine has three host conflicts the project doesn't account for, so I added a local,
untracked [docker-compose.override.yml](../docker-compose.override.yml):

| Conflict on this machine | Effect | Workaround used |
|---|---|---|
| Jenkins (Java) already owns **:8080** | `docker compose up` can't publish the gateway | gateway published as **8180→8080** |
| native `mongod.exe` owns **:27017** | mongo publish would fail | dropped that publish |
| native `redis-server.exe` owns **:6379** | redis publish would fail | dropped that publish |

The frontend image bakes its API URL at **build** time (`ARG VITE_API_URL`), so the override also
passes `VITE_API_URL=http://localhost:8180`. Without that override the UI cannot reach the gateway
on this machine.

Reproduce:

```sh
docker compose up -d --build
GATEWAY=http://localhost:8180 node seed/seed.mjs
docker compose exec -T postgres psql -U postgres -d user_db -c \
  "UPDATE users SET roles = ARRAY['user','admin'] WHERE handle = 'admin';"
GATEWAY=http://localhost:8180 node scripts/e2e.mjs
```

---

## Verdict at a glance

| Area | Status |
|---|---|
| Backend auth (register/login/refresh rotation/reuse revocation/rate limits) | ✅ works |
| Posts: CRUD, visibility, hashtags, bookmarks, reactions, comments | ✅ works |
| Follower visibility (event-fed replica) | ✅ works **after** the fix in Bug #2 |
| Chat: REST + realtime, persistence, membership isolation, typing/read | ✅ works |
| Media: presigned upload, type/size limits, public read, ownership delete | ✅ works |
| Moderation + admin (reports, resolve, stats, overview, suspend) | ✅ works |
| Blocks (search hiding, DM blocking) | ✅ works **after** the fix in Bug #2 |
| Gateway security (header stripping, admin gate, CORS, rate limits) | ✅ works |
| **Frontend auth / whole UI** | ❌ **broken — Bug #1** |
| Notifications, follower visibility, blocks on a **cold start** | ❌ **broken — Bug #2** |
| Data durability across `compose down` | ❌ **broken — Bug #3** |
| Gateway container health | ⚠️ always "unhealthy" — Bug #4 |
| WebSocket ack contract | ⚠️ never acks — Bug #5 |

**Test evidence**

- Unit tests: **36/36 pass** across all 6 services (api-gateway 10, user 4, content 10, chat 5,
  notification 4, media 3).
- Project e2e (`scripts/e2e.mjs`): **45/48 → 49/52** after restarting the consumers (Bug #2).
- Frontend production build (`vite build`): ✅ clean, 1985 modules.
- Ad-hoc API battery (blocks/moderation/admin/CORS/rate limits): 27 pass / 5 fail, of which **4 were
  my own test's fault** (wrong path for `/admin/users/:id/suspend`, and hitting the 10/min auth
  rate limit); re-verified correctly afterwards.

---

## Work through these one by one

### Bug #1 — CRITICAL: the frontend never really logs anyone in (mock bypass)

**Symptom:** after signing in on the real UI, the home feed shows *"Authentication required"* and
every REST call returns 401, even after a hard reload. Nothing in the UI works — feed, chat,
notifications, admin, uploads.

**Evidence:** localStorage after "login" contains a fabricated session with **no tokens**:

```json
{ "user": { "id": "user-1", "handle": "alice", "roles": ["admin"] } }
```

`id` is a placeholder (real ids are UUIDs) and `roles` is `["admin"]` for everyone.

**Root cause:** [AuthContext.jsx](../socialpulse/src/context/AuthContext.jsx) has two commented
"MOCK … BYPASS" blocks that replaced the real implementation:

- `login()` never calls the API. It always sets `alice` / `user-1` / `roles:["admin"]`.
- It writes `{ token: "mock-token", user }`, but [session.js](../socialpulse/src/services/session.js)
  reads `accessToken` / `refreshToken` → `getToken()` is always `null` → the axios request
  interceptor in [api.js](../socialpulse/src/services/api.js) attaches no `Authorization` header →
  401 on everything.
- The boot `useEffect` also bypasses `auth.me()`, so a stored session is never validated/refreshed.

**Note the inconsistency:** the real implementations already exist and work —
[authService.js](../socialpulse/src/services/authService.js) `login`/`register`/`logout` do the right
thing, and **register is not mocked**, so registering through the UI would actually work and even
log you in. Only `login` and the session bootstrap are stubbed.

**Fix:** delete both mock blocks and call the real service, e.g.
`const d = await auth.login(i, p); setUser(d.user);` and in the boot effect
`auth.me().then(setUser)…` with the existing refresh-on-401 interceptor.

**Verify:** sign in on `http://localhost:5173` as `alice`/`password123` → feed renders the seeded
posts with images; no 401s in the network panel.

---

### Bug #2 — CRITICAL: RabbitMQ consumers give up on a cold start, permanently

**Symptom:** on a fresh `docker compose up`, three whole feature areas are silently dead until you
restart those containers:

- **no notifications at all** (likes, comments, follows, messages)
- **follower visibility is wrong** (the content-service `follows` replica stays empty, so
  followers-only posts don't reach followers)
- **blocking has no effect on chat** (the chat `blocks` replica stays empty, so blocked users can
  still DM you)

**Evidence** (fresh `compose down && compose up`, then `rabbitmqctl list_queues`):

```
WARN [Blocks]            blocks consumer disabled: connect ECONNREFUSED 172.18.0.4:5672
WARN [EventsConsumer]    consumer disabled:       connect ECONNREFUSED 172.18.0.4:5672
WARN [FollowsConsumer]   consumer disabled:       connect ECONNREFUSED 172.18.0.4:5672
```

…and afterwards `list_queues` returns **zero** queues. Restarting just those three containers
brings all three queues up with a consumer each, and the affected features immediately work.

**Root cause:** `depends_on: condition: service_healthy` gates on
`rabbitmq-diagnostics -q ping`, but RabbitMQ answers that before the AMQP listener accepts
connections on :5672. Every consumer does a **single** `amqp.connect()` in `onModuleInit()`, catches
the error, logs one warning, and never retries. Healthchecks only probe `/health`, so Docker still
reports all three services **healthy** — the failure is invisible.

**Fix (both halves are worth doing):**
1. Make the consumers retry with backoff (reconnect loop) instead of one-shot — this also fixes
   RabbitMQ restarts at runtime, not just boot ordering.
2. Harden the RabbitMQ healthcheck, e.g.
   `rabbitmq-diagnostics -q check_port_connectivity` (or `check_running`).

**Verify:** `docker compose down && docker compose up -d`, wait 60s, then
`docker compose exec -T rabbitmq rabbitmqctl list_queues name consumers` must show
`content-service.follows`, `chat-service.blocks`, `notification-service.events` each with 1 consumer.

---

### Bug #3 — HIGH: `docker compose down` destroys all database data

**Symptom:** after `docker compose down && docker compose up -d`, every user, post, conversation
and notification is gone (verified: 0 users, 0 posts). Re-running the seed is the only way back.

**Root cause:** only `minio_data` is a **named** volume. Postgres, MongoDB and Redis all rely on
**anonymous** volumes, which Compose does not reuse when it recreates the containers — it orphans
them. I confirmed a pile of orphaned anonymous volumes accumulating on this machine.

**Fix:** give them named volumes, e.g. `postgres_data:/var/lib/postgresql/data`,
`mongo_data:/data/db`, `redis_data:/data`, and add them to the `volumes:` section. Also run
`docker volume prune` once to clear the orphans this bug already created.

---

### Bug #4 — MEDIUM: the api-gateway container is permanently "unhealthy"

**Symptom:** `docker compose ps` shows `api-gateway … (unhealthy)` forever, although
`GET /health` returns 200 from the host. Anything that gates on gateway health
(`docker compose up --wait`, CI, an orchestrator) would treat a healthy gateway as broken.

**Evidence:** inside the container,

```
wget -qO- http://localhost:8080/health   → connection refused (exit 1)
wget -qO- http://127.0.0.1:8080/health   → 200
```

**Root cause:** [server.ts:67](../api-gateway/src/server.ts#L67) listens on `host: '0.0.0.0'`
(IPv4 only). BusyBox `wget` resolves `localhost` to `::1` first, so the healthcheck never connects.
The NestJS services don't have this problem because `app.listen(port)` without a host binds the
dual-stack `::`.

**Fix:** either listen on `'::'`, or point the healthcheck at `127.0.0.1`.

---

### Bug #5 — MEDIUM: WebSocket handlers never acknowledge

**Symptom:** the project's own e2e fails:
`FAIL C cannot join A and B's conversation room (ack: "no-ack")`.

**Evidence:** probed live as `alice` — **none** of these ever invoke the ack callback:

```
conversation:join  (own conversation)   → no ack in 3000ms
conversation:join  (non-existent conv)  → no ack in 3000ms
message:send       (own conversation)   → no ack in 2500ms
```

**Root cause:** in [chat.gateway.ts](../chat-service/src/gateway/chat.gateway.ts) every handler is
`return this.run(c, async () => { … })`, and `run()` returns `undefined` (it swallows errors into an
`error` event). Nest's Socket.IO adapter only replies when the handler resolves to a defined value,
so the client's ack callback is never called — neither on success nor on failure.

**Impact:** today the frontend never uses acks, so nothing user-visible breaks; but any client that
waits on an ack (including the repo's own e2e) hangs, and failures are only observable as a bare
`error` event.

**Fix:** have `run()` return an ack payload (e.g. `{ ok: true }` / `{ ok: false, code, message }`)
and return it from each handler.

---

### Bug #6 — LOW: ports are hardcoded in three places

`:8080` is baked into the compose port mapping, and the frontend image defaults
`ARG VITE_API_URL=http://localhost:8080`. Changing the gateway port therefore needs a compose edit
**and** a frontend rebuild with new build args (which is exactly what my override does).

**Fix:** `ports: ["${GATEWAY_PORT:-8080}:8080"]` in compose and
`VITE_API_URL: ${VITE_API_URL:-http://localhost:8080}` under `frontend.build.args`, so a single env
var moves the whole stack.

---

### Bug #7 — LOW: stray JSON files in the repo root contain passwords

`login.json`, `login2.json`, `reg.json` hold `password` fields (the demo password today, but the
files are clearly used for hand-made API probes), and none of them is gitignored — `.gitignore`
covers `.env`, `.keys` and `.env.tmp` only. A real credential pasted into one of these would be
committed.

**Fix:** add `*.json` probes to `.gitignore`, or move them under `scripts/probes/` and delete the
ones you don't need. (`batch.json` is a bare `{"ids": []}` payload.)

---

### Bug #8 — INFO: small contract oddities (deliberate? worth writing down)

- An **unauthenticated** request to an unknown route returns **401**, not 404
  (`GET /nope` → `UNAUTHORIZED`). Auth is checked before routing, so this fails closed — fine for
  security, surprising for clients and for API probing.
- Swagger (`/api/docs`) is only reachable on each service's own port, not through the gateway —
  matches the README, just easy to trip over.
- `PROGRESS.md` is stale in the project's favour: it says the chat `BlocksModule` is "not yet wired
  into code", but it **is** wired (`assertCanMessage` in `MessagesService.send`, `hiddenFor` filters
  conversation lists). `docs/KNOWN_LIMITS.md` mentions neither this report's bugs nor the WSL note
  that no longer applies.

---

## Verified working perfectly fine

Everything below was exercised against the live stack and behaved exactly as designed.

**Auth & session**
- register (201 + tokens), login by handle or email (200), wrong password → 401
- `/users/me` with token; 401 without
- refresh returns **new** tokens, old refresh token is rejected, and reuse **revokes the whole
  session** (rotation + reuse detection)
- suspended user cannot log in; can log in again after unsuspend
- `/auth` rate limit 10/min returns a proper `RATE_LIMITED` envelope; global limit is separate

**Posts & feed**
- create public / followers / private posts; follower sees followers-only, non-follower does not;
  neither can fetch followers-only or private posts directly
- hashtag lookup, bookmarks, likes, comments
- cross-user protection: editing or deleting someone else's post → 403, post survives

**Blocks**
- block → DM attempt → 403 `USER_BLOCKED`; search hides the user in both directions; unblock
  restores both (verified after the event propagates)

**Moderation & admin**
- report post (valid reasons only; invalid reason → 400), one report per target
- non-admin → 403 on `/admin/*`; admin lists open reports, resolves with `remove`, post is gone
- `/admin/users` list, suspend/unsuspend, `/admin/users/stats`, and `/admin/overview` aggregates
  both services correctly

**Chat**
- direct conversation create/list, membership isolation (non-member → 403/404)
- realtime delivery over **both** WebSocket and polling transports through the gateway
  (verified `transport: "websocket"` connects for both chat and notifications)
- messages persisted and returned in history; invalid socket token refused at handshake

**Notifications**
- like/comment/follow produce notifications, unread-count tracks them, read + read-all work,
  cross-user read → 403/404

**Media**
- presign accepts valid image types; rejects bad content-type (400) and oversized avatar (400);
  requires auth
- browser-side multipart upload succeeds, file is readable at `publicUrl`, delete is
  owner-only (403 for others)

**Gateway hardening**
- client `x-user-id` / `x-user-roles` are stripped and replaced with verified values
  (spoofing attempt confirmed inert)
- `/users/batch` is unreachable through the gateway (404) — internal only
- `/admin/*` requires the admin role; `x-request-id` is echoed; CORS allowlist accepts
  `http://localhost:5173` and emits **no** ACAO header for foreign origins
- `Expect: 100-continue` is dropped before proxying (the uncommitted fix in
  [auth.ts](../api-gateway/src/auth.ts) — that patch, plus the `canonicalPath` admin-bypass fix and
  the `TRUST_PROXY` parsing, all have matching unit tests and look good to commit)

---

## Current state of the machine (after the fixes)

- Stack is **up and healthy** straight from `docker compose up -d --build`: gateway
  `http://localhost:8180`, UI `http://localhost:5173`, RabbitMQ management
  `http://localhost:15672`, MinIO/S3 `http://localhost:9000`.
- Data now survives `docker compose down` (named volumes). Use `down -v` for a clean slate.
- Consumers attach on their own at boot — no manual restarts needed.
- Seeded demo users (`password123`): `admin` (admin role), `alice`, `bob`, `carol`, plus throwaway
  `e2e_*` / `chk_*` users created by the test runs.
- Left in the repo: the fixes themselves, this report, and
  [docker-compose.override.yml](../docker-compose.override.yml) (only needed on this machine —
  delete it if 8080/27017/6379 are free where you deploy).

# SocialPulse — Project Overview & SRS

**Purpose:** review/defense reference. Covers what the system is, every functional and
non-functional requirement, the technology behind each capability, quality evidence, defects
found+fixed, what is still open, and exactly what you must configure.
**Verified against a running stack on 2026-10-13** (not a code read): `scripts/e2e.mjs` 50/50,
36/36 unit tests, cold-start test, full browser walkthrough.

---

## 1. What the system is

A Instagram/Twitter-style **social platform** delivered as **7 independently deployable units**
(6 backend + 1 frontend) behind a single API gateway, with realtime chat and notifications.

- Users register, follow each other, post with images and hashtags, like/comment/share/bookmark,
  and control who sees each post (`public` / `followers` / `private`).
- Realtime **1:1 chat** with typing indicators, read/delivery receipts, presence and reactions.
- Realtime **notifications** generated from activity across services.
- **Blocking** (hides users from search and prevents DMs) and **admin moderation**
  (report → resolve/remove, suspend users, dashboard stats).
- Media upload through presigned browser→object-storage posts (bytes never pass through the API).

## 2. Architecture

```mermaid
flowchart LR
  FE[Frontend :5173<br/>React SPA + nginx] -->|REST + WS| GW[api-gateway :8080<br/>Fastify]
  FE -->|presigned POST / GET| S3[(LocalStack S3 :9000)]
  GW --> US[user-service :3003]
  GW --> CS[content-service :3001]
  GW --> CH[chat-service :3002]
  GW --> NS[notification-service :3004]
  GW --> MS[media-service :3005]
  US --> PG1[(Postgres user_db)]
  CS --> PG2[(Postgres content_db)]
  CH --> MG[(Mongo chat_db)]
  CH --> RD[(Redis)]
  NS --> MG2[(Mongo notification_db)]
  MS --> S3
  US & CS & CH -- publish --> MQ{{RabbitMQ exchange app.events (topic)}}
  MQ -- user.followed/unfollowed --> CS
  MQ -- user.blocked/unblocked --> CH
  MQ -- likes/comments/follows/messages --> NS
```

| Unit | Port | Runtime | Data store | Responsibility |
|---|---|---|---|---|
| api-gateway | 8080 | **Fastify** (Node 20) | – | auth verification, routing, rate limiting, CORS, header trust |
| user-service | 3003 | NestJS + **Prisma** | Postgres `user_db` | accounts, profiles, follows, blocks, admin suspend |
| content-service | 3001 | NestJS + **Prisma** | Postgres `content_db` | posts, comments, reactions, bookmarks, hashtags, moderation |
| chat-service | 3002 | NestJS + **Mongoose** + Socket.IO | Mongo `chat_db`, Redis | conversations, messages, receipts, presence, reactions |
| notification-service | 3004 | NestJS + **Mongoose** + Socket.IO | Mongo `notification_db` | notification generation, grouping, unread counts, realtime push |
| media-service | 3005 | NestJS + **minio SDK** | LocalStack S3 | presigned uploads, type/size policy, ownership-scoped delete |
| frontend (`socialpulse/`) | 5173 | **React 18 + Vite + Tailwind** + nginx | – | SPA: feed, chat, notifications, admin, settings |

Only the gateway (8080), MinIO/S3 (9000) and the frontend (5173) are published to the host;
every other service is reachable **only** on the internal Docker network.

## 3. Functional requirements → status → technology

| # | Requirement | Status | Implemented with |
|---|---|---|---|
| FR-1 | Register / login / logout / refresh session | ✅ | NestJS + **argon2** hashing, **RS256 JWT** (15 min access), refresh tokens **sha256-hashed** in Postgres, rotated on use, **reuse revokes all sessions** |
| FR-2 | Profiles: view, edit, avatar, search | ✅ | Prisma (`User`), cursor pagination, media-service presigned avatar upload |
| FR-3 | Follow / unfollow, follower lists | ✅ | Prisma self-relation `Follow`; emits `user.followed/unfollowed` |
| FR-4 | Posts with media, hashtags, visibility | ✅ | Prisma (`Post`, `Hashtag`, `PostHashtag`, `PostVisibility` enum) |
| FR-5 | Visibility enforcement (public/followers/private) | ✅ | content-service keeps a **local `follows` replica** fed by events (no per-request network hop), async `visible()` + `visibility.spec.ts` |
| FR-6 | Like / comment / share / bookmark | ✅ | Prisma `Reaction`, `Comment` (self-relation for replies), `Share`, `Bookmark`; denormalised counters |
| FR-7 | Feed + hashtag pages + author pages + bookmarks | ✅ | cursor pagination (`items` + `nextCursor`), envelope `{success,data,error}` |
| FR-8 | Realtime 1:1 chat (send, typing, read/delivery receipts, presence, reactions) | ✅ | Socket.IO over the gateway, JWT handshake auth, Mongo messages, **Redis presence pub/sub**, `sent → delivered → read` status machine |
| FR-9 | Realtime notifications (like, comment, share, follow, message) | ✅ | RabbitMQ consumer → Mongo, **grouping** (likes per post, messages per conversation), unread count, socket push to `user:{id}` room |
| FR-10 | Media upload from the browser | ✅ | media-service issues a **presigned S3 POST policy** enforcing type + size; browser uploads directly; public-read objects; delete restricted to own `kind/userId/` prefix |
| FR-11 | Blocking (hide from search, stop DMs) | ✅ | `user.blocked/unblocked` events → **local blocks replicas** in user-service (search) and chat-service (`assertCanMessage`) |
| FR-12 | Reporting + admin moderation + dashboard | ✅ | `Report` model, one report per user/target, admin queue, `remove` (soft-delete) or `dismiss`, `/admin/overview` aggregates user+content stats |
| FR-13 | Admin user management (suspend/unsuspend) | ✅ | suspend revokes refresh tokens + blocks login; `roles=[user,admin]` gate at the gateway **and** in the services |
| FR-14 | Admin UI | ✅ | React admin page: stats tiles, report cards with post-caption preview, suspend/unsuspend |

### API surface (all through the gateway)

```
/auth      POST register|login|refresh|logout
/users     GET/PATCH me, GET me/blocks, GET search, GET :id, POST/DELETE :id/follow,
           POST/DELETE :id/block, GET :id/followers, GET :id/following, POST batch (internal only)
/posts     POST, GET (feed?authorId=), GET bookmarks, GET hashtags/:tag, GET/PATCH/DELETE :id,
           POST/DELETE :id/reactions, POST :id/share, POST/DELETE :id/bookmark,
           POST :id/comments, GET :id/comments, POST :id/report
/conversations  POST direct/:otherUserId, GET, GET :id/messages
/notifications  GET, GET unread-count, POST read-all, POST :id/read   (+ /notifications/socket.io)
/media     POST uploads, DELETE
/admin     users (list/stats/suspend/unsuspend), reports (list/stats/resolve), overview
/health    every service
```

## 4. Non-functional requirements → how they are met → evidence

| # | Requirement | How it is met | Evidence |
|---|---|---|---|
| NFR-1 **Security: identity** | RS256 JWT signed with a keypair (private key only in user-service env); gateway verifies every request and **strips client `x-user-id`/`x-user-roles`** | spoof-header test returns the caller's real identity |
| NFR-2 **Security: passwords** | argon2 | `auth-tokens.spec.ts` |
| NFR-3 **Security: session** | 15-min access token + 30-day refresh token (sha256-hashed at rest), rotation on use, **reuse detection revokes the whole session** | e2e: old refresh rejected *and* the session is dead afterwards |
| NFR-4 **Security: abuse control** | 300 req/min global (keyed by user id, else IP), **10 req/min on /auth** | 429 with `RATE_LIMITED` envelope |
| NFR-5 **Security: browser** | CORS allowlist (`CORS_ORIGINS`), no ACAO header for foreign origins; `/admin/*` requires the admin role; `/users/batch` unreachable externally; internal-only routes 404 | e2e + manual probes |
| NFR-6 **Availability / resilience** | health endpoint per service, Docker healthchecks, `depends_on` with health conditions, **AMQP consumers retry forever with capped exponential backoff + jitter** and reconnect on broker restart | cold `compose up` → all 3 queues consuming with no manual restart |
| NFR-7 **Data durability** | named Docker volumes for Postgres/Mongo/Redis/MinIO, soft-delete (`deletedAt`) for moderated content | `down`+`up` keeps all rows |
| NFR-8 **Performance / scalability** | denormalised counters instead of COUNT(*), cursor (not offset) pagination, Redis-backed presence, message prefetch=10, stateless services, only the gateway is exposed | feed returns ≤20 items/page; counters read directly |
| NFR-9 **Observability** | structured JSON logs, `x-request-id` echoed in and out (traces a request across 6 services), `/health` on every service, RabbitMQ management UI :15672 | request-id echo verified |
| NFR-10 **Portability / repeatability** | one `docker compose up --build` builds all 7 images from Dockerfiles, env-driven config, `.env.example` + `scripts/gen-keys.sh`, CI workflow (`.github/workflows/ci.yml`) running build+test per service | verified from a clean cold start |
| NFR-11 **Testability** | 36 unit tests (pure-logic specs) + an end-to-end suite (`scripts/e2e.mjs`) that exercises auth, visibility, interactions, chat (incl. WebSockets), notifications and media against the live stack | 36/36 and 50/50, exit code preserved |

## 5. Technology matrix (one line per capability)

| Capability | Technology |
|---|---|
| API gateway / proxy / rate limit | Fastify + `@fastify/http-proxy` + `@fastify/rate-limit` + `@fastify/cors` |
| Microservice framework | NestJS (TypeScript, Express platform) |
| Relational persistence | PostgreSQL 16 + Prisma ORM (migrations `0001_init`, `0002_blocks/follows`, `0003_reports`) |
| Document persistence | MongoDB 7 + Mongoose (chat, notifications) |
| Event bus | RabbitMQ 3 (topic exchange `app.events`, durable queues) + `amqplib` |
| Presence / ephemeral state | Redis 7 + `ioredis` |
| Object storage | LocalStack S3 (S3 API) + presigned POST policies, `minio` SDK in media-service |
| Realtime | Socket.IO (server) + socket.io-client (browser), JWT handshake auth, proxied by the gateway |
| Auth | RS256 JWT (15 min), refresh-token rotation, argon2 |
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, framer-motion, react-router 6, axios, lucide-react |
| Static hosting | nginx |
| Packaging | Docker / Docker Compose (Node 20 Alpine images) |

## 6. Data model summary

**user_db (Postgres/Prisma):** `User` (uuid id, unique email+handle, displayName, bio, avatarUrl,
verified, `roles[]`, passwordHash, suspendedAt) · `RefreshToken` (tokenHash unique, expiresAt,
revokedAt) · `Follow` (composite follower/following) · `Block`.

**content_db (Postgres/Prisma):** `Post` (authorId, caption, mediaUrls json, visibility,
likesCount/commentsCount/sharesCount, deletedAt) · `Comment` (self-relation for replies) ·
`Reaction` (targetType post|comment) · `Share` · `Bookmark` · `Hashtag` + `PostHashtag` ·
`Report` (target, reason, status, resolvedAt) · local `Follows` replica (event-fed).

**chat_db (Mongo):** `Conversation` (type, `members[]`, `hiddenFor[]`, lastMessage) ·
`Message` (conversationId, senderId, content, mediaUrls, status sent|delivered|read, readBy[],
reactions[{userId,emoji}]).

**notification_db (Mongo):** `Notification` (recipientId, type, actorId, `actorIds[]` grouped,
targetId, groupKey, count, preview, readAt).

## 7. Event-driven integration

Exchange `app.events` (topic, durable). Producers/consumers:

| Routing key | Producer | Consumer(s) → effect |
|---|---|---|
| `user.registered`, `user.suspended`, `user.unsuspended` | user-service | – (audit/extension points) |
| `user.followed` / `user.unfollowed` | user-service | content (follows replica → visibility), notification (follow notification) |
| `user.blocked` / `user.unblocked` | user-service | chat (blocks replica → DM enforcement) |
| `post.liked`, `post.shared`, `comment.created` | content-service | notification |
| `message.sent`, `conversation.created` | chat-service | notification (grouped per conversation) |

Queues are durable; consumers declare bindings themselves and **retry the connection with capped
exponential backoff** (`src/common/amqp-consumer.ts`), so a broker that is still booting — or a
broker restart later — never silently disables a feature.

## 8. Defects found and fixed during QA (full detail in [QA-REPORT.md](QA-REPORT.md))

1. **Frontend login was a mock** (hardcoded `user-1`/`admin`, wrong session shape) → no real auth at all.
2. **AMQP consumers gave up on cold start** → notifications, follower visibility and blocking were dead.
3. **`docker compose down` destroyed all data** (anonymous volumes not reused).
4. **Gateway container permanently "unhealthy"** (IPv4 bind vs BusyBox resolving `localhost`→`::1`).
5. **WebSocket handlers never acked** (Nest only acks defined return values).
6. **Ports hardcoded** in compose + frontend build args.
7. **Password-bearing probe JSONs not gitignored.**
8. **UX/doc rot:** chat showed raw UUIDs, admin showed raw UUIDs, stale KNOWN_LIMITS/PROGRESS notes.

## 9. What is still open (be honest in review)

**Product gaps (documented in [KNOWN_LIMITS.md](KNOWN_LIMITS.md))**
- Group conversations are not implemented (direct only).
- Chat reactions are stored/served but the UI cannot pick an emoji.
- Video uploads/transcodes unsupported (images only: jpg/png/webp/gif).
- Search is a simple substring match on handle/display name/email — no filters or ranking.
- No email verification, password reset or OAuth — email+password only.

**Technical debt / hardening**
- `mediaUrls` are **not validated against our own bucket** — a caller could store an arbitrary URL.
  Add an allowlist check in content-service if that trust boundary matters.
- RabbitMQ has **no data volume**: queues are durable, but events published while the broker
  container is recreated are lost (consumers re-declare queues on boot).
- Swagger (`/api/docs`) is only on each service's own port — not proxied through the gateway.
- Unknown routes requested **without** a token return `401` instead of `404` (auth is checked before
  routing; fails closed by design).
- Gateway rate-limit counters are **in-memory**, so limits are per-instance (add Redis store before
  scaling the gateway horizontally).
- Services are single-instance and untested for horizontal scaling; no TLS anywhere in the dev stack.
- CI workflow exists but was not exercised locally (only local `jest`/`e2e`/`vite build` were run).

## 10. What you must do — checklist

**API keys / secrets: none.** Everything runs self-hosted — there is no third-party SaaS, so there
is nothing to sign up for and no external API key to obtain. What you *do* have is local
configuration:

| Item | Where | Action |
|---|---|---|
| **JWT keypair (RS256)** | `.env` (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`), private copy in `.keys/` | already generated by `scripts/gen-keys.sh` — **regenerate for any real deployment**; losing/leaking it invalidates or forges sessions |
| `CORS_ORIGINS` | `.env` | set to your real frontend origin(s), comma-separated |
| `MINIO_PUBLIC_URL` | `.env` | must be the **browser-reachable** S3 URL |
| `GATEWAY_PORT` / `PUBLIC_API_URL` | `.env` | only if 8080 is taken (it is, by Jenkins, on this machine → 8180); rebuild the frontend after changing |
| Postgres / MinIO / Mongo / Redis / Rabbit credentials | `docker-compose.yml` | dev defaults (`postgres/postgres`, `minioadmin/minioadmin`, no DB auth) — **change before any shared deployment** |
| DB/broker ports | `docker-compose.yml` | remove `27017`, `6379`, `5672`, `15672` publishes for production |

**Then, in order:**
1. Commit the current work — **nothing is committed yet**. `git status` shows 30 modified files and
   12 untracked; the untracked ones I created are the three `src/common/amqp-consumer.ts`,
   `docs/QA-REPORT.md`, `docs/PROJECT-OVERVIEW.md` and `docker-compose.override.yml` (the rest —
   `scripts/e2e.mjs`, `*.patch`, `tsconfig.build.json`, the `login.json`/`reg.json` probes — were
   already untracked before I started).
2. `docker compose down -v` for a clean slate, or keep the named volumes to preserve data.
3. Re-seed and run the demo script below.
4. Optionally delete `docker-compose.override.yml` on a machine where 8080/27017/6379 are free.

## 11. Run & demo

```sh
cp .env.example .env && sh scripts/gen-keys.sh     # RS256 keypair -> .env
docker compose up --build -d
sh seed/seed.sh                                    # demo data + promotes "admin"
GATEWAY=http://localhost:8080 node scripts/e2e.mjs # 50 checks, exits non-zero on failure
```

UI: `http://localhost:5173` · Gateway: `:8080` · RabbitMQ mgmt: `:15672` · S3: `:9000`
Logins (password `password123`): `admin`, `alice`, `bob`, `carol`.

**Review demo script (~2 min):** log in as `alice` → post with `#sunset` → as `bob` like + comment
and watch alice's bell update live → `carol` posts *followers-only* (visible to alice, hidden from
a brand-new user) → chat alice↔bob with typing and read receipts → report a post, log in as
`admin`, resolve it and watch it disappear → block a user and confirm search hides them and DMs
are refused.

# PROGRESS
- [x] Step 1: user-service + follower-aware visibility in content-service
- [x] Step 2: api-gateway
- [x] Step 3: notification-service
- [x] Step 4: media-service (MinIO)
- [x] Step 5: moderation
- [x] Step 6: frontend (core done; chat additions + adapter pending)
- [x] Step 7: finish (compose, env, keys, seed, README, CI) - done (frontend service added)

## Assumptions / notes
- Only a partial snapshot was uploaded. `content-service/src/users/user-client.service.ts`, pagination helpers, events service, modules, and the rest of both services were NOT provided, so they were not read. Batch shape is inferred from posts.service.ts (`authors.get(id)?.username`, `UserClient.author(...)`); verify against the real file.
- Output lives in `socialpulse-platform/`; merge new files into your real repo.

## Step 1 notes
- user-service (port 3003, own `user_db`): /auth/{register,login,refresh,logout}, /users/{me,search,batch,:id,:id/follow,:id/followers,:id/following}. argon2, RS256 15 min, refresh tokens sha256-hashed, rotated on use; reuse revokes all sessions. `suspendedAt` column added now for Step 5.
- Env: `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (PEM, `\n`-escaped). Key script comes in Step 7.
- Batch: `POST /users/batch {ids}` -> array of `{id, username, displayName, handle, avatarUrl, verified}`. content-service's real `UserClient` was not provided; if it expects another shape/method, adjust `UsersController.batch` only.
- Follower visibility: local replicated `follows` table in content-service fed by `user.followed` / `user.unfollowed` (new event) via `FollowsConsumer` (queue `content-service.follows`). Chosen over per-request calls: simpler, no network hop. `visible()` is now async (call sites updated); logic in `visibility.ts` + spec.
- TODO on merge: add `FollowsConsumer` to content-service providers; apply migration `0002_follows`. No backfill of pre-existing follows (none exist).
- NOT VERIFIED: dependency install timed out in the sandbox, so jest / prisma generate / tsc were not run. Run `npm i && npx prisma generate && npm test` in user-service and content-service.
- Smoke: `sh user-service/scripts/smoke.sh`.

## Step 2 notes
- api-gateway (Fastify, port 8080, only published backend port): verifies RS256/ES256, strips client `x-user-id`/`x-user-roles`, injects trusted ones. Routes: /auth,/users -> user; /posts -> content; /conversations,/chat -> chat; /socket.io -> chat with WS proxy (chat-service verifies the handshake token itself). Global 300/min (per user or IP), /auth 10/min, CORS allowlist `CORS_ORIGINS`, `x-request-id` in/out + JSON logs, GET /health.
- Public without token: /auth/{register,login,refresh,logout}, /health, /socket.io, GET /users/:uuid(/followers|/following) (optional viewer). `/users/batch` is NOT routable without a token and should stay internal; it is called service-to-service.
- compose: content/chat/user use `expose` only; postgres also creates `user_db` via seed/init-user-db.sql (runs on first volume init only; run `docker compose down -v` if postgres already existed). chat gateway CORS now env allowlist (`CORS_ORIGINS`; empty list blocks all browsers). Postgres/Mongo/Redis/Rabbit ports still published for dev; remove for prod.
- Moderation admin routes will need `/admin` prefix added in Step 5. NOT VERIFIED: no install/run (sandbox); run `npm i && npm test` in api-gateway and `sh api-gateway/smoke.sh`.

## Step 3 notes
- notification-service (port 3004, Mongo `notification_db`): consumes post.liked, comment.created, post.shared, user.followed, message.sent (queue `notification-service.events`). Self-notifications skipped; likes grouped per post (distinct actors, only while unread); messages grouped per conversation with a count.
- REST (via gateway): GET /notifications?cursor&limit, GET /notifications/unread-count, POST /notifications/:id/read, POST /notifications/read-all. Cursor = base64(updatedAt_id).
- Realtime: Socket.IO at path `/notifications/socket.io` (same `auth.token` handshake); events `notification:new {notification}` and `notification:unread {count}` to room `user:{id}`. Gateway proxies `/notifications` incl. WS.
- Assumed payloads (not in provided code): comment.created `{postId, postAuthorId, authorId, content}`; message.sent `{conversationId, senderId, recipientIds | participantIds, preview}`. If content-service/chat-service publish different field names, edit `toDrafts` in `src/rules.ts` only. If comment.created lacks the post author, content-service must add `postAuthorId`.
- Notifications store actor ids only; frontend resolves names via GET /users/:id.
- NOT VERIFIED (no install in sandbox): `npm i && npm test`.

## Step 4 notes
- media-service (port 3005, MinIO): `POST /media/uploads {kind: avatar|post, contentType, size}` -> `{key, uploadUrl, fields, method:'POST', publicUrl, expiresIn}`; client POSTs multipart (all `fields`, then `file` last). Uses a presigned POST policy so MinIO enforces content-type + size (avatar 2MB jpg/png/webp, post 8MB +gif). `DELETE /media {key}` only for the caller's own `kind/<userId>/` keys. `publicUrl` goes straight into post `mediaUrls` / user `avatarUrl`.
- Deviation from "only gateway exposed": MinIO port 9000 is published because browsers upload/read directly (set `MINIO_PUBLIC_URL` to the browser-reachable host in non-local deploys). Bucket auto-created with public-read on objects.
- Note: content-service does not yet validate that mediaUrls point at our bucket; add an allowlist check if untrusted URLs matter. NOT VERIFIED (no install): `npm i && npm test`.

## Step 5 notes
- user-service: `POST|DELETE /users/:id/block`, `GET /users/me/blocks`; blocking severs follows both ways; user search now hides blocked users in both directions; events `user.blocked`, `user.unblocked`. Admin (`/admin/users`, role admin): list/search, `POST :id/suspend|unsuspend` (revokes refresh tokens; already-issued access tokens stay valid up to 15 min), `GET stats`; events `user.suspended|unsuspended`. Migration `0002_blocks`.
- content-service `src/moderation/` (ModerationModule): `POST /posts/:id/report`, `POST /posts/:postId/comments/:id/report` (one report per user/target), admin `GET /admin/reports?status=`, `GET /admin/reports/stats`, `POST /admin/reports/:id/resolve {action: remove|dismiss}` (soft-deletes post/comment, closes all open reports on that target). Migration `0003_reports`. TODO on merge: import ModerationModule in AppModule; confirm `../common/prisma.service` and `../events/events.service` paths.
- chat-service `src/blocks/` (BlocksModule): local replica of blocks via events + `assertCanMessage(sender, recipients)` and `hiddenFor(me)`. NOT yet wired into code that wasn't provided: add `await this.blocks.assertCanMessage(senderId, recipients)` at the start of MessagesService.send (and in direct-conversation creation), and filter `hiddenFor(me)` out of conversation lists. Import BlocksModule where MessagesService lives.
- Gateway: `/admin/*` requires role admin (403 otherwise); proxies `/admin/users` -> user-service, `/admin/reports` -> content-service; `GET /admin/overview` aggregates both stats. Making someone admin: set `roles = {user,admin}` in DB (seed script in Step 7 creates one).
- Frontend Step 6 should send `reason` from: spam, harassment, hate, violence, nudity, misinformation, other.
- NOT VERIFIED (no install): run `npm test` in each service.

## Step 7 notes (partial)
- Done: single `docker compose up`, root `.env.example`, `scripts/gen-keys.sh`, `seed/seed.sh|seed.mjs` (via gateway API; admin promoted with psql), root README with mermaid/ports/events/demo, `.github/workflows/ci.yml` (matrix build+test per service, frontend build when package.json exists, compose config check).
- Postgres 5432 is no longer published (README says so); remove DB/broker port mappings entirely for prod.
- Missing for Step 7: frontend Dockerfile/compose service (frontend package.json/vite config were not in the snapshot).
- Seed requires services healthy; chat conversations seeded through POST /conversations/direct/:id.

## Step 6 notes (partial)
- Done: `session.js` (token store), `api.js` (shared axios, single-flight refresh on 401, envelope helpers; `postsService` now uses it), AuthContext (login/register/logout/me bootstrap), ToastContext (framer-motion), NotificationsContext (live unread via `/notifications/socket.io`), protected + admin + guest routes with animated transitions, BottomNav with unread badge (mobile-first, safe-area aware), skeleton loaders, pages: Login, Register, Profile (follow optimistic, block, posts grid), Search (debounced; `#tag` + Enter -> Explore), Explore (`/explore/:tag`), Bookmarks, Notifications (live, grouped text, mark read/all), Settings (profile edit, avatar upload via media-service, blocked list/unblock, logout), Admin (stats, reports remove/dismiss, user suspend). Home shows real images (`mediaUrls[0]`) and hashtag links; CreateModal uploads an image via presigned POST. Socket auth uses a function so reconnects send a fresh token. Frontend Dockerfile/nginx + compose `frontend` service (port 5173).
- Assumptions to verify: content-service routes `GET /posts?authorId=`, `GET /posts/bookmarks`, `GET /posts/hashtags/:tag` (service has the methods; controller paths unseen); `adapters/postAdapter.toUiPost` must pass through `mediaUrls` (and `id`, `caption`) - the adapter and `layouts/AppLayout`, chat components were not provided. New pages render without AppLayout; BottomNav is provided by the protected route shell, so if AppLayout has its own nav, drop one.
- Done: Chat additions (split mobile list/window screens). Report-post button in Home. Added docs/KNOWN_LIMITS.md.
- NOT DONE: Group conversations, reactions UI, blocked state. Blocked by WSL breaking on Windows.

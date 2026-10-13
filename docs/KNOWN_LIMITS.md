# Known Limits
- No group chat support yet (direct conversations only).
- Search doesn't support complex filtering.
- Chat reactions only render statically, the UI does not allow picking an emoji.
- Uploaded media doesn't support video transcodes yet.
- Posts/media are not moderated by ML; reports go to the admin queue.
- The frontend bakes `VITE_API_URL` in at build time, so changing the gateway port needs a
  `docker compose up -d --build frontend` (see `.env.example`).
- RabbitMQ, MongoDB and Redis are dev-defaults with no auth/TLS; put them behind a private network
  before deploying anywhere real.

#!/bin/sh
# Run after `docker compose up -d`. Seeds demo users/posts/follows/conversations and promotes "admin".
cd "$(dirname "$0")/.."
node seed/seed.mjs
docker compose exec -T postgres psql -U postgres -d user_db -c "UPDATE users SET roles = ARRAY['user','admin'] WHERE handle = 'admin';"

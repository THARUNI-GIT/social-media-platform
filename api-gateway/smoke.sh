#!/bin/sh
B=${BASE:-http://localhost:8080}; J='content-type: application/json'; S=$(date +%s)
echo "health:"; curl -s $B/health
echo "\nno token -> 401:"; curl -s -o /dev/null -w "%{http_code}" $B/posts
R=$(curl -s -X POST $B/auth/register -H "$J" -d "{\"email\":\"g$S@x.io\",\"password\":\"password123\",\"handle\":\"g$S\",\"displayName\":\"G\"}")
T=$(echo "$R" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
echo "\nspoofed header ignored, feed with token:"; curl -s "$B/posts?limit=2" -H "Authorization: Bearer $T" -H "x-user-id: evil"
echo "\nauth rate limit (expect 429 at end):"; for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " -X POST $B/auth/login -H "$J" -d '{"identifier":"x","password":"y"}'; done; echo

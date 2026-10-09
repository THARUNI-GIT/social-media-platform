#!/bin/sh
# Generates an RS256 keypair and writes JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (\n-escaped) into ./.env
set -e
cd "$(dirname "$0")/.."
mkdir -p .keys && openssl genrsa -out .keys/priv.pem 2048 2>/dev/null && openssl rsa -in .keys/priv.pem -pubout -out .keys/pub.pem 2>/dev/null
esc() { awk '{printf "%s\\n",$0}' "$1"; }
[ -f .env ] || cp .env.example .env
grep -v '^JWT_PRIVATE_KEY=\|^JWT_PUBLIC_KEY=' .env > .env.tmp || true
printf 'JWT_PRIVATE_KEY="%s"\nJWT_PUBLIC_KEY="%s"\n' "$(esc .keys/priv.pem)" "$(esc .keys/pub.pem)" >> .env.tmp && mv .env.tmp .env
echo "keys written to .env (private key in .keys/, gitignored)"

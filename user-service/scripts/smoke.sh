#!/bin/sh
# Usage: BASE=http://localhost:3003 sh scripts/smoke.sh   (direct to user-service; uses x-user-id like the gateway would)
B=${BASE:-http://localhost:3003}; S=$(date +%s); J='content-type: application/json'
reg(){ curl -s -X POST $B/auth/register -H "$J" -d "{\"email\":\"$1$S@x.io\",\"password\":\"password123\",\"handle\":\"$1$S\",\"displayName\":\"$1\"}"; }
A=$(reg alice); Bb=$(reg bob)
AID=$(echo "$A" | sed 's/.*"user":{"id":"\([^"]*\)".*/\1/'); BID=$(echo "$Bb" | sed 's/.*"user":{"id":"\([^"]*\)".*/\1/')
echo "ids: $AID $BID"
echo "login:";   curl -s -X POST $B/auth/login -H "$J" -d "{\"identifier\":\"alice$S\",\"password\":\"password123\"}" | cut -c1-120
echo "\nfollow:"; curl -s -X POST $B/users/$BID/follow -H "x-user-id: $AID"
echo "\nprofile:"; curl -s $B/users/$BID -H "x-user-id: $AID"
echo "\nfollowers:"; curl -s "$B/users/$BID/followers?limit=5" -H "x-user-id: $AID"
echo "\nsearch:"; curl -s "$B/users/search?q=bob$S" -H "x-user-id: $AID"
echo "\nbatch:"; curl -s -X POST $B/users/batch -H "$J" -d "{\"ids\":[\"$AID\",\"$BID\"]}"
echo

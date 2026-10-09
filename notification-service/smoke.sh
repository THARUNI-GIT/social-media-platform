#!/bin/sh
# direct to service: BASE=http://localhost:3004 (needs port mapped) or via gateway with TOKEN
B=${BASE:-http://localhost:8080}; H="Authorization: Bearer $TOKEN"
curl -s $B/notifications/unread-count -H "$H"; echo; curl -s "$B/notifications?limit=5" -H "$H"; echo; curl -s -X POST $B/notifications/read-all -H "$H"; echo

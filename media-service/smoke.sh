#!/bin/sh
# TOKEN=<access token>; presign -> upload a PNG -> fetch public URL -> delete
B=${BASE:-http://localhost:8080}; H="Authorization: Bearer $TOKEN"; J='content-type: application/json'
printf '\211PNG\r\n\032\n' > /tmp/t.png; SZ=$(wc -c < /tmp/t.png)
R=$(curl -s -X POST $B/media/uploads -H "$H" -H "$J" -d "{\"kind\":\"post\",\"contentType\":\"image/png\",\"size\":$SZ}"); echo "$R"
echo "(upload with the returned fields as multipart form fields, then -F file=@/tmp/t.png last; then GET publicUrl)"

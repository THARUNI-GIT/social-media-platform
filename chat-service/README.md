# Chat Service (NestJS + MongoDB + Redis + Socket.IO + RabbitMQ)
## Run
    cp .env.example .env && npm i && npm run start:dev
Swagger: http://localhost:3002/api/docs · Tests: `npm test`
## Env
PORT, MONGO_URI, REDIS_URL, RABBITMQ_URL, JWT_PUBLIC_KEY (PEM; `\n` escapes allowed; RS256/ES256)
## REST (via gateway: x-user-id / x-user-roles)
    curl -X POST localhost:3002/conversations/direct/<otherId> -H "x-user-id: <me>"
    curl "localhost:3002/conversations/<id>/messages?limit=20" -H "x-user-id: <me>"
## Socket test
    openssl genrsa -out priv.pem 2048 && openssl rsa -in priv.pem -pubout -out pub.pem   # set JWT_PUBLIC_KEY from pub.pem
    npm i socket.io-client jsonwebtoken
    node -e "const jwt=require('jsonwebtoken'),{io}=require('socket.io-client'),fs=require('fs');
    const t=jwt.sign({sub:'<me>'},fs.readFileSync('priv.pem'),{algorithm:'RS256'});
    const s=io('http://localhost:3002',{auth:{token:t}});
    s.on('connect',()=>s.emit('message:send',{conversationId:'<convId>',type:'text',content:'hi'}));
    s.on('message:new',console.log);s.on('error',console.log);s.on('connect_error',e=>console.log(e.message))"
## Notes
- Status: sent on create; set to delivered when a recipient socket is connected (server-side check, no extra client ack event, to keep the event contract fixed); read on `message:read` (also marks earlier messages). Status only moves forward.
- Delivered/read updates reach the sender by re-emitting `message:new` (same id) and `message:read:update`; clients upsert by id.
- Redis: `presence:{userId}` TTL 60s (heartbeat every 20s), channel `presence-events`, typing keys `typing:{conv}:{user}` TTL 5s.
- Events on `app.events`: message.sent, conversation.created.
- REST conversation objects include an extra `onlineParticipantIds` convenience field.

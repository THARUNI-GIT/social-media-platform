# Content Service (NestJS + Prisma + PostgreSQL + RabbitMQ)
## Run
    cp .env.example .env && npm i && npx prisma generate && npx prisma migrate deploy && npm run start:dev
Swagger: http://localhost:3001/api/docs · Tests: `npm test`
## Env
PORT, DATABASE_URL, RABBITMQ_URL, USER_SERVICE_URL (optional; author falls back to `{id}`)
## Sample curl (gateway headers simulated)
    U=11111111-1111-1111-1111-111111111111
    curl -X POST localhost:3001/posts -H "x-user-id: $U" -H 'content-type: application/json' -d '{"caption":"hello #GoodVibes"}'
    curl "localhost:3001/posts?limit=5" -H "x-user-id: $U"
    curl -X POST localhost:3001/posts/<id>/reactions -H "x-user-id: $U" -H 'content-type: application/json' -d '{"reactionType":"like"}'
    curl -X POST localhost:3001/posts/<id>/comments -H "x-user-id: $U" -H 'content-type: application/json' -d '{"content":"nice"}'
Events published on exchange `app.events`: post.created, post.deleted, post.liked, comment.created, post.shared.

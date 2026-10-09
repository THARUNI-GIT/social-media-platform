# SocialPulse Contracts (inferred from existing code)

## Auth
- Access token: JWT RS256 (chat accepts RS256/ES256), verified with `JWT_PUBLIC_KEY` (PEM, `\n`-escaped allowed). Claims: `sub` (user id), `roles` (string[]). Chat also tolerates `userId`/`id`.
- Frontend sends `Authorization: Bearer <token>` (REST) and `socket.handshake.auth.token` (Socket.IO).
- Behind the gateway, services trust headers `x-user-id`, `x-user-roles` (comma-separated). Gateway strips client-supplied copies.

## REST envelope
`{ success: true, data }` / `{ success: false, error: { code, message } }`. Cursor pages: `data = { items, nextCursor }` (query `cursor`, `limit`). Swagger at `/api/docs`, health at `/health`.

## Content-service (3001) routes in use
GET/POST /posts, GET /posts/:id, PATCH/DELETE /posts/:id, POST|DELETE /posts/:id/reactions, POST /posts/:id/comments, POST /posts/:id/share, POST|DELETE /posts/:id/bookmark, bookmarks list, by-hashtag list.
Post JSON: `{ id, author, caption, tags[], mediaUrls[], visibility(public|followers|private), likes, isLiked, commentsCount, comments[{id,user,text}], createdAt }`.

## Chat-service (3002)
REST: POST /conversations/direct/:otherId, GET /conversations, GET /conversations/:id/messages.
Socket client->server: `conversation:join|leave {conversationId}`, `message:send {conversationId,type,content}`, `message:typing:start|stop {conversationId}`, `message:read {conversationId,messageId}`, `message:react {messageId,emoji}`, `message:unreact {messageId}`.
Socket server->client: `message:new {message}`, `conversation:updated {conversation}`, `message:typing {conversationId,userId,isTyping}`, `message:read:update {conversationId,messageId,userId,readAt}`, `message:reaction:update {messageId,reactions}`, `presence:update {userId,status,lastSeenAt}`, `error {code,message}`.
Rooms: `user:{id}`, `conv:{id}`. Status: sent -> delivered -> read (forward only). Redis: `presence:{id}` TTL 60s, channel `presence-events`, `typing:{conv}:{user}` TTL 5s.

## Events (topic exchange `app.events`, JSON body, routing key = event name)
| Event | Payload |
|---|---|
| post.created | postId, authorId, caption, tags[], mediaUrls, visibility, createdAt |
| post.deleted | postId, authorId |
| post.liked | postId, authorId, userId, reactionType, likesCount |
| post.shared | shareId, postId, authorId, userId, comment, sharesCount |
| comment.created | (not provided) assumed: commentId, postId, postAuthorId, authorId, content |
| message.sent | (not provided) assumed: messageId, conversationId, senderId, recipientIds[], preview |
| conversation.created | (not provided) assumed: conversationId, participantIds[], type |
| user.registered (new) | userId, handle, displayName, createdAt |
| user.followed (new) | followerId, followingId, createdAt |
| user.unfollowed (new) | followerId, followingId |

## User batch lookup (new, user-service)
`POST /users/batch {ids:[]}` -> `data: [{ id, username, displayName, handle, avatarUrl, verified }]`. `username` = handle (content-service reads `.username`).

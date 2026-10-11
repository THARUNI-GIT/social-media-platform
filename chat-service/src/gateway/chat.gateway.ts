import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConversationsService, shapeConv } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { PresenceService, PRESENCE_CHANNEL } from '../redis/presence.service';
import { RedisService } from '../redis/redis.service';
import { ConvDto, ReactDto, ReadDto, SendDto, UnreactDto } from './ws.dto';

const uroom = (id: string) => `user:${id}`; const croom = (id: string) => `conv:${id}`;

@WebSocketGateway({ cors: { origin: (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean), credentials: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  constructor(private convs: ConversationsService, private msgs: MessagesService, private presence: PresenceService, private redis: RedisService) {}

  afterInit(server: Server) {
    // JWT handshake middleware: verify signature with JWT_PUBLIC_KEY, reject on failure.
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('UNAUTHORIZED'));
        const key = (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n');
        const p: any = jwt.verify(token, key, { algorithms: ['RS256', 'ES256'] });
        const uid = p.sub ?? p.userId ?? p.id;
        if (!uid) return next(new Error('UNAUTHORIZED'));
        socket.data.userId = String(uid); next();
      } catch { next(new Error('UNAUTHORIZED')); }
    });
    // Let REST handlers keep socket rooms in sync (join/leave across instances via adapter).
    this.convs.rooms = {
      join: (u, c) => this.server.in(uroom(u)).socketsJoin(croom(c)),
      leave: (u, c) => this.server.in(uroom(u)).socketsLeave(croom(c)),
      emitUpdated: (conversation) => this.server.to(croom(conversation.id)).emit('conversation:updated', { conversation }),
    };
    // presence-events pub/sub: every instance emits to its local sockets.
    // Presence events: support both Redis and the in-memory development fallback.
if (typeof this.redis.sub.subscribe === 'function') {
  // Real Redis subscriber
  this.redis.sub.subscribe(PRESENCE_CHANNEL);
  this.redis.sub.on('message', (ch, raw) => {
    if (ch !== PRESENCE_CHANNEL) return;

    try {
      const e = JSON.parse(raw);
      this.server.local
        .to(e.conversationIds.map(croom))
        .except(uroom(e.userId))
        .emit('presence:update', {
          userId: e.userId,
          status: e.status,
          lastSeenAt: e.lastSeenAt,
        });
    } catch (error) {
      console.error('Invalid presence event received:', error);
    }
  });
} else {
  // In-memory EventEmitter fallback for local development
  this.redis.sub.on('message', (ch: string, raw: string) => {
    if (ch !== PRESENCE_CHANNEL) return;

    try {
      const e = JSON.parse(raw);
      this.server.local
        .to(e.conversationIds.map(croom))
        .except(uroom(e.userId))
        .emit('presence:update', {
          userId: e.userId,
          status: e.status,
          lastSeenAt: e.lastSeenAt,
        });
    } catch (error) {
      console.error('Invalid presence event received:', error);
    }
  });
}
  }

  async handleConnection(client: Socket) {
    const uid: string = client.data.userId;
    await client.join(uroom(uid));
    const ids = await this.convs.idsForUser(uid);
    if (ids.length) await client.join(ids.map(croom));
    await this.presence.heartbeat(uid);
    client.data.hb = setInterval(() => this.presence.heartbeat(uid).catch(() => {}), 20_000);
    if ((await this.server.in(uroom(uid)).fetchSockets()).length === 1)
      await this.presence.publish({ userId: uid, status: 'online', lastSeenAt: new Date().toISOString(), conversationIds: ids });
  }

  async handleDisconnect(client: Socket) {
    clearInterval(client.data.hb);
    const uid: string = client.data.userId; if (!uid) return;
    if ((await this.server.in(uroom(uid)).fetchSockets()).length === 0) {
      await this.presence.clear(uid);
      await this.presence.publish({ userId: uid, status: 'offline', lastSeenAt: await this.presence.lastSeen(uid), conversationIds: await this.convs.idsForUser(uid) });
    }
  }

  // ---------- helpers ----------
  private async v<T extends object>(cls: new () => T, data: unknown): Promise<T> {
    const o = plainToInstance(cls, data ?? {}); const errs = await validate(o as object, { whitelist: true });
    if (errs.length) throw Object.assign(new Error(errs.flatMap((e) => Object.values(e.constraints ?? {})).join('; ')), { code: 'VALIDATION_ERROR' });
    return o;
  }
  private async run(client: Socket, fn: () => Promise<void>) {
    try { await fn(); } catch (e: any) { client.emit('error', { code: e?.response?.code ?? e?.code ?? 'ERROR', message: e?.response?.message ?? e?.message ?? 'Error' }); }
  }

  // ---------- client -> server ----------
  @SubscribeMessage('conversation:join')
  join(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => { const d = await this.v(ConvDto, b); await this.msgs.assertMember(d.conversationId, c.data.userId); await c.join(croom(d.conversationId)); });
  }
  @SubscribeMessage('conversation:leave')
  leave(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => { const d = await this.v(ConvDto, b); await c.leave(croom(d.conversationId)); });
  }

  @SubscribeMessage('message:send')
  send(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => {
      const d = await this.v(SendDto, b); const uid = c.data.userId;
      const { message, conversation, recipients } = await this.msgs.send(uid, d);
      this.server.to(croom(d.conversationId)).emit('message:new', { message });
      if (conversation) this.server.to(croom(d.conversationId)).emit('conversation:updated', { conversation: shapeConv(conversation) });
      // delivered: a recipient socket is connected and received the broadcast
      const online = (await Promise.all(recipients.map(async (r) => (await this.server.in(uroom(r)).fetchSockets()).length > 0))).some(Boolean);
      if (online) {
        const delivered = await this.msgs.markDelivered(message.id);
        if (delivered) this.server.to(uroom(uid)).emit('message:new', { message: delivered }); // sender upserts by id
      }
    });
  }

  @SubscribeMessage('message:typing:start')
  typingStart(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) { return this.typing(c, b, true); }
  @SubscribeMessage('message:typing:stop')
  typingStop(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) { return this.typing(c, b, false); }
  private typing(c: Socket, b: unknown, isTyping: boolean) {
    return this.run(c, async () => {
      const d = await this.v(ConvDto, b); const userId = c.data.userId;
      await this.msgs.assertMember(d.conversationId, userId);
      await this.presence.setTyping(d.conversationId, userId, isTyping);
      c.to(croom(d.conversationId)).emit('message:typing', { conversationId: d.conversationId, userId, isTyping });
    });
  }

  @SubscribeMessage('message:read')
  read(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => {
      const d = await this.v(ReadDto, b);
      const r = await this.msgs.markRead(c.data.userId, d.conversationId, d.messageId); if (!r) return;
      this.server.to(croom(d.conversationId)).emit('message:read:update', { conversationId: r.conversationId, messageId: r.messageId, userId: r.userId, readAt: r.readAt });
    });
  }

  @SubscribeMessage('message:react')
  react(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => {
      const d = await this.v(ReactDto, b); const r = await this.msgs.react(c.data.userId, d.messageId, d.emoji);
      this.server.to(croom(r.conversationId)).emit('message:reaction:update', { messageId: r.messageId, reactions: r.reactions });
    });
  }
  @SubscribeMessage('message:unreact')
  unreact(@ConnectedSocket() c: Socket, @MessageBody() b: unknown) {
    return this.run(c, async () => {
      const d = await this.v(UnreactDto, b); const r = await this.msgs.unreact(c.data.userId, d.messageId);
      this.server.to(croom(r.conversationId)).emit('message:reaction:update', { messageId: r.messageId, reactions: r.reactions });
    });
  }
}

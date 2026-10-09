import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { PrismaService } from '../common/prisma.service';
/** Keeps the local `follows` table in sync from user-service events. Register in AppModule providers. */
@Injectable()
export class FollowsConsumer implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('FollowsConsumer'); private conn: any;
  constructor(private db: PrismaService) {}
  async onModuleInit() {
    if (!process.env.RABBITMQ_URL) return;
    try {
      this.conn = await amqp.connect(process.env.RABBITMQ_URL); const ch = await this.conn.createChannel();
      await ch.assertExchange('app.events', 'topic', { durable: true });
      const q = await ch.assertQueue('content-service.follows', { durable: true });
      await ch.bindQueue(q.queue, 'app.events', 'user.followed'); await ch.bindQueue(q.queue, 'app.events', 'user.unfollowed');
      await ch.consume(q.queue, async (msg) => {
        if (!msg) return;
        try {
          const e = JSON.parse(msg.content.toString()); const key = { followerId: e.followerId, followingId: e.followingId };
          if (msg.fields.routingKey === 'user.followed') await this.db.follow.upsert({ where: { followerId_followingId: key }, create: key, update: {} });
          else await this.db.follow.deleteMany({ where: key });
          ch.ack(msg);
        } catch (err: any) { this.log.error(err.message); ch.nack(msg, false, false); }
      });
    } catch (e: any) { this.log.warn(`consumer disabled: ${e.message}`); }
  }
  async onModuleDestroy() { await this.conn?.close().catch(() => {}); }
}

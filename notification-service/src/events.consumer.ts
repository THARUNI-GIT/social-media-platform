import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { NotificationsService } from './notifications.service';
export const KEYS = ['post.liked', 'comment.created', 'post.shared', 'user.followed', 'message.sent'];
@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('EventsConsumer'); private conn: any;
  constructor(private svc: NotificationsService) {}
  async onModuleInit() {
    if (!process.env.RABBITMQ_URL) return;
    try {
      this.conn = await amqp.connect(process.env.RABBITMQ_URL); const ch = await this.conn.createChannel();
      await ch.assertExchange('app.events', 'topic', { durable: true });
      const q = await ch.assertQueue('notification-service.events', { durable: true });
      for (const k of KEYS) await ch.bindQueue(q.queue, 'app.events', k);
      await ch.consume(q.queue, async (m) => {
        if (!m) return;
        try { await this.svc.handleEvent(m.fields.routingKey, JSON.parse(m.content.toString())); ch.ack(m); }
        catch (e: any) { this.log.error(`${m.fields.routingKey}: ${e.message}`); ch.nack(m, false, false); }
      });
    } catch (e: any) { this.log.warn(`consumer disabled: ${e.message}`); }
  }
  async onModuleDestroy() { await this.conn?.close().catch(() => {}); }
}

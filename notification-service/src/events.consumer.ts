import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RetryingConsumer } from './common/amqp-consumer';

export const KEYS = ['post.liked', 'comment.created', 'post.shared', 'user.followed', 'message.sent'];

/** Turns `app.events` messages into notifications. Retries the broker connection forever (see RetryingConsumer). */
@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('EventsConsumer');
  private consumer: RetryingConsumer | null = null;
  constructor(private svc: NotificationsService) {}

  async onModuleInit() {
    this.consumer = new RetryingConsumer({
      logName: 'EventsConsumer',
      queue: 'notification-service.events',
      bindings: KEYS,
      handle: async (routingKey, body) => this.svc.handleEvent(routingKey, body),
    });
    this.consumer.start();
  }

  async onModuleDestroy() { await this.consumer?.onModuleDestroy(); }
}

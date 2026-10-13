import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RetryingConsumer } from '../common/amqp-consumer';

/** Keeps the local `follows` table in sync from user-service events. Register in AppModule providers. */
@Injectable()
export class FollowsConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: RetryingConsumer | null = null;
  constructor(private db: PrismaService) {}

  async onModuleInit() {
    this.consumer = new RetryingConsumer({
      logName: 'FollowsConsumer',
      queue: 'content-service.follows',
      bindings: ['user.followed', 'user.unfollowed'],
      handle: async (routingKey, e) => {
        const key = { followerId: e.followerId, followingId: e.followingId };
        if (routingKey === 'user.followed') await this.db.follow.upsert({ where: { followerId_followingId: key }, create: key, update: {} });
        else await this.db.follow.deleteMany({ where: key });
      },
    });
    this.consumer.start();
  }

  async onModuleDestroy() { await this.consumer?.onModuleDestroy(); }
}

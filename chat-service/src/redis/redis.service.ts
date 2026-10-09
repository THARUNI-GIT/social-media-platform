import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private log = new Logger('RedisService');
  pub: any;
  sub: any;
  private isIoRedis = false;

  constructor() {
    const url = process.env.REDIS_URL;
    const isProd = process.env.NODE_ENV === 'production';

    if (url) {
      try {
        this.pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null, retryStrategy: (times) => Math.min(times * 100, 3000) });
        this.sub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null, retryStrategy: (times) => Math.min(times * 100, 3000) });
        this.isIoRedis = true;
      } catch (e: any) {
        if (isProd) {
          throw new Error(`Redis connection failed in production: ${e.message}`);
        }
        this.log.warn(`Redis connection failed, falling back to in-memory event bus (non-production): ${e.message}`);
        const bus = new EventEmitter();
        this.pub = bus;
        this.sub = bus;
      }
    } else {
      if (isProd) {
        throw new Error('REDIS_URL is required in production');
      }
      this.log.warn('REDIS_URL not set, falling back to in-memory event bus (non-production)');
      const bus = new EventEmitter();
      this.pub = bus;
      this.sub = bus;
    }
  }

  async publish(channel: string, message: string) {
    if (this.isIoRedis) {
      await (this.pub as Redis).publish(channel, message).catch((e) => this.log.warn(`redis publish error: ${e.message}`));
    } else {
      (this.sub as EventEmitter).emit('message', channel, message);
    }
  }

  async onModuleDestroy() {
    if (this.isIoRedis) {
      await (this.pub as Redis).quit().catch(() => {});
      await (this.sub as Redis).quit().catch(() => {});
    }
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

export const EXCHANGE = 'app.events';

@Injectable()
export class EventsService implements OnModuleDestroy {
  private log = new Logger('Events');
  private ch: amqp.Channel | null = null;
  private conn: any = null;
  private connecting: Promise<void> | null = null;

  private async ensure() {
    if (this.ch && this.conn) return;
    if (!process.env.RABBITMQ_URL) return;

    this.connecting ??= (async () => {
      try {
        this.conn = await amqp.connect(process.env.RABBITMQ_URL!);
        this.conn.on('error', (err: any) => {
          this.log.warn(`RabbitMQ connection error: ${err?.message}`);
          this.ch = null;
          this.conn = null;
        });
        this.conn.on('close', () => {
          this.log.warn('RabbitMQ connection closed, will reconnect automatically on next publish');
          this.ch = null;
          this.conn = null;
        });
        this.ch = await this.conn.createChannel();
        await this.ch.assertExchange(EXCHANGE, 'topic', { durable: true });
        this.log.log(`Connected to RabbitMQ exchange "${EXCHANGE}"`);
      } catch (e: any) {
        this.log.warn(`RabbitMQ connection failed: ${e.message}`);
        this.ch = null;
        this.conn = null;
      } finally {
        this.connecting = null;
      }
    })();
    await this.connecting;
  }

  async publish(key: string, payload: object) {
    try {
      await this.ensure();
      if (!this.ch) {
        this.log.warn(`Publish failed for routing key "${key}": RabbitMQ channel unavailable`);
        return false;
      }
      const ok = this.ch.publish(EXCHANGE, key, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        contentType: 'application/json',
      });
      if (!ok) {
        this.log.warn(`Publish buffer full for routing key "${key}"`);
      }
      return ok;
    } catch (e: any) {
      this.log.error(`Publish failed for routing key "${key}": ${e.message}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.conn?.close().catch(() => {});
  }
}

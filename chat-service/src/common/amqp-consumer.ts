import { Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

export interface ConsumerSpec {
  /** Durable queue to consume. */
  queue: string;
  /** Routing keys bound to the `app.events` topic exchange. */
  bindings: string[];
  /** Called with the parsed body; throw to nack (the message is dropped, not retried forever). */
  handle: (routingKey: string, body: any) => Promise<void>;
  /** Logger name shown in Nest logs. */
  logName: string;
  prefetch?: number;
}

/**
 * Durable RabbitMQ consumer that retries with capped exponential backoff instead of giving up.
 *
 * A one-shot `amqp.connect()` in `onModuleInit` is a trap on a cold `docker compose up`: the
 * broker's healthcheck (`rabbitmq-diagnostics ping`) starts passing before the AMQP listener
 * accepts connections, so the connect is refused and the consumer would stay dead for the whole
 * life of the container - silently killing notifications, follower visibility and block
 * enforcement. It also handles a broker restart at runtime: `close` schedules a reconnect.
 */
export class RetryingConsumer implements OnModuleDestroy {
  private log: Logger;
  private conn: any = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = false;

  constructor(private spec: ConsumerSpec) { this.log = new Logger(spec.logName); }

  start(): void {
    if (!process.env.RABBITMQ_URL) { this.log.log('RABBITMQ_URL not set - consumer disabled'); return; }
    this.schedule(0);
  }

  private backoff(): number {
    const base = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt, 5));
    return base + Math.floor(Math.random() * 500); // jitter so a fleet of services does not stampede
  }

  private schedule(delay: number): void {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.connect(); }, delay);
    this.timer.unref?.();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      const conn: any = await amqp.connect(process.env.RABBITMQ_URL!);
      const ch: any = await conn.createChannel();
      await ch.assertExchange('app.events', 'topic', { durable: true });
      const q = await ch.assertQueue(this.spec.queue, { durable: true });
      for (const key of this.spec.bindings) await ch.bindQueue(q.queue, 'app.events', key);
      await ch.prefetch(this.spec.prefetch ?? 10);
      await ch.consume(q.queue, async (m: any) => {
        if (!m) return;
        try { await this.spec.handle(m.fields.routingKey, JSON.parse(m.content.toString())); ch.ack(m); }
        catch (e: any) { this.log.error(`${m.fields.routingKey}: ${e.message}`); ch.nack(m, false, false); }
      });
      conn.on('error', (e: any) => this.log.warn(`connection error: ${e?.message}`));
      conn.on('close', () => {
        this.conn = null;
        if (this.stopped) return;
        this.log.warn(`connection closed - reconnecting to "${this.spec.queue}"`);
        this.attempt = 1;
        this.schedule(this.backoff());
      });
      this.conn = conn;
      this.attempt = 0;
      this.log.log(`consuming "${this.spec.queue}" for [${this.spec.bindings.join(', ')}]`);
    } catch (e: any) {
      this.attempt += 1;
      const delay = this.backoff();
      this.log.warn(`connect failed (attempt ${this.attempt}, retrying in ${delay}ms): ${e.message}`);
      this.schedule(delay);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    await this.conn?.close().catch(() => {});
  }
}

import { ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as amqp from 'amqplib';
import { blockKey, isBlockedEitherWay } from './blocks';

@Schema({ collection: 'blocks' }) export class Block { @Prop({ required: true }) blockerId: string; @Prop({ required: true }) blockedId: string; }
export const BlockSchema = SchemaFactory.createForClass(Block); BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

/** Local replica of user-service blocks (fed by user.blocked / user.unblocked). */
@Injectable()
export class BlocksService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Blocks'); private conn: any;
  constructor(@InjectModel(Block.name) private model: Model<Block>) {}
  async between(a: string, b: string) {
    const rows = await this.model.find({ $or: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }).lean();
    return isBlockedEitherWay(new Set(rows.map((r) => blockKey(r.blockerId, r.blockedId))), a, b);
  }
  /** Call from MessagesService.send / conversation creation: throws if any recipient is blocked either way. */
  async assertCanMessage(sender: string, recipients: string[]) {
    for (const r of recipients) if (await this.between(sender, r)) throw new ForbiddenException({ code: 'USER_BLOCKED', message: 'You cannot message this user' });
  }
  /** Users hidden from `me` (both directions) - filter conversation lists / user lookups with this. */
  async hiddenFor(me: string): Promise<string[]> {
    const rows = await this.model.find({ $or: [{ blockerId: me }, { blockedId: me }] }).lean();
    return [...new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)))];
  }
  async onModuleInit() {
    if (!process.env.RABBITMQ_URL) return;
    try {
      this.conn = await amqp.connect(process.env.RABBITMQ_URL); const ch = await this.conn.createChannel();
      await ch.assertExchange('app.events', 'topic', { durable: true });
      const q = await ch.assertQueue('chat-service.blocks', { durable: true });
      await ch.bindQueue(q.queue, 'app.events', 'user.blocked'); await ch.bindQueue(q.queue, 'app.events', 'user.unblocked');
      await ch.consume(q.queue, async (m) => {
        if (!m) return;
        try { const e = JSON.parse(m.content.toString()); const key = { blockerId: e.blockerId, blockedId: e.blockedId };
          if (m.fields.routingKey === 'user.blocked') await this.model.updateOne(key, { $setOnInsert: key }, { upsert: true }); else await this.model.deleteOne(key);
          ch.ack(m); } catch (err: any) { this.log.error(err.message); ch.nack(m, false, false); }
      });
    } catch (e: any) { this.log.warn(`blocks consumer disabled: ${e.message}`); }
  }
  async onModuleDestroy() { await this.conn?.close().catch(() => {}); }
}

import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RetryingConsumer } from '../common/amqp-consumer';
import { blockKey, isBlockedEitherWay } from './blocks';

@Schema({ collection: 'blocks' }) export class Block { @Prop({ required: true }) blockerId: string; @Prop({ required: true }) blockedId: string; }
export const BlockSchema = SchemaFactory.createForClass(Block); BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

/** Local replica of user-service blocks (fed by user.blocked / user.unblocked). */
@Injectable()
export class BlocksService implements OnModuleInit, OnModuleDestroy {
  private consumer: RetryingConsumer | null = null;
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
    this.consumer = new RetryingConsumer({
      logName: 'Blocks',
      queue: 'chat-service.blocks',
      bindings: ['user.blocked', 'user.unblocked'],
      handle: async (routingKey, e) => {
        const key = { blockerId: e.blockerId, blockedId: e.blockedId };
        if (routingKey === 'user.blocked') await this.model.updateOne(key, { $setOnInsert: key }, { upsert: true });
        else await this.model.deleteOne(key);
      },
    });
    this.consumer.start();
  }
  async onModuleDestroy() { await this.consumer?.onModuleDestroy(); }
}

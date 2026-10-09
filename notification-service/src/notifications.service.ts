import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Notification, NotificationDoc } from './notification.schema';
import { Draft, decodeCursor, encodeCursor, toDrafts } from './rules';
import { NotificationsGateway } from './notifications.gateway';

export const shape = (n: NotificationDoc) => ({
  id: String(n._id), type: n.type, actorId: n.actorId, actorIds: n.actorIds, count: n.count, targetId: n.targetId, preview: n.preview,
  read: !!n.readAt, createdAt: (n as any).createdAt, updatedAt: (n as any).updatedAt,
});
@Injectable()
export class NotificationsService {
  constructor(@InjectModel(Notification.name) private model: Model<Notification>, private ws: NotificationsGateway) {}

  async handleEvent(key: string, payload: any) { for (const d of toDrafts(key, payload)) await this.create(d); }

  /** Likes group per post (distinct actors); messages group per conversation (count). Only unread groups are merged. */
  async create(d: Draft) {
    let doc: NotificationDoc;
    if (d.groupKey) {
      const isLike = d.type === 'like';
      doc = (await this.model.findOneAndUpdate(
        { recipientId: d.recipientId, groupKey: d.groupKey, readAt: null },
        {
          $set: { actorId: d.actorId, ...(d.preview ? { preview: d.preview } : {}) },
          ...(isLike ? {} : { $inc: { count: 1 } }),
          $push: { actorIds: { $each: [d.actorId], $position: 0, $slice: 20 } },
          $setOnInsert: { type: d.type, targetId: d.targetId, ...(isLike ? { count: 1 } : {}) }, // recipientId/groupKey/readAt come from the filter
        },
        { upsert: true, new: true },
      ))!;
      if (isLike) { // distinct likers: count = unique actors
        const uniq = [...new Set(doc.actorIds)]; doc.actorIds = uniq; doc.count = uniq.length; await doc.save();
      }
    } else {
      doc = await this.model.create({ recipientId: d.recipientId, type: d.type, actorId: d.actorId, actorIds: [d.actorId], targetId: d.targetId, preview: d.preview });
    }
    this.ws.toUser(d.recipientId, 'notification:new', { notification: shape(doc) });
    this.ws.toUser(d.recipientId, 'notification:unread', { count: await this.unread(d.recipientId) });
    return doc;
  }

  async list(userId: string, limit: number, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.model.find({ recipientId: userId, ...(c ? { $or: [{ updatedAt: { $lt: c.t } }, { updatedAt: c.t, _id: { $lt: c.id } }] } : {}) })
      .sort({ updatedAt: -1, _id: -1 }).limit(limit + 1).exec();
    const more = rows.length > limit; const items = more ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return { items: items.map(shape), nextCursor: more && last ? encodeCursor((last as any).updatedAt, String(last._id)) : null };
  }
  unread(userId: string) { return this.model.countDocuments({ recipientId: userId, readAt: null }).exec(); }
  async markRead(userId: string, id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Notification not found' });
    const n = await this.model.findOneAndUpdate({ _id: id, recipientId: userId }, { $set: { readAt: new Date() } }, { new: true });
    if (!n) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Notification not found' });
    const count = await this.unread(userId); this.ws.toUser(userId, 'notification:unread', { count }); return { id, read: true, unread: count };
  }
  async markAll(userId: string) {
    await this.model.updateMany({ recipientId: userId, readAt: null }, { $set: { readAt: new Date() } });
    this.ws.toUser(userId, 'notification:unread', { count: 0 }); return { unread: 0 };
  }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, index: true }) recipientId: string;
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) actorId: string;          // latest actor
  @Prop({ type: [String], default: [] }) actorIds: string[]; // grouped actors (most recent first, capped)
  @Prop() targetId?: string;
  @Prop() groupKey?: string;
  @Prop({ default: 1 }) count: number;
  @Prop() preview?: string;
  @Prop({ type: Date, default: null }) readAt: Date | null;
}
export type NotificationDoc = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientId: 1, updatedAt: -1, _id: -1 });
NotificationSchema.index({ recipientId: 1, groupKey: 1, readAt: 1 });

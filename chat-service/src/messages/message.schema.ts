import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  mediaUrls: string[];

  @Prop({ default: 'sent' })
  status: string;

  @Prop({ type: [String], default: [] })
  readBy: string[];

  @Prop({ type: [{ userId: String, emoji: String, createdAt: Date }], default: [] })
  reactions: Array<{ userId: string; emoji: string; createdAt: Date }>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });

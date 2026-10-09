import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ default: 'direct' })
  type: string;

  @Prop({ type: [String], required: true, index: true })
  members: string[];

  @Prop({ type: [String], default: [] })
  hiddenFor: string[];

  @Prop({ type: Object, default: null })
  lastMessage: any;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ members: 1 });

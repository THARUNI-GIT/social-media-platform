import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './message.schema';
import { Conversation, ConversationDocument } from '../conversations/conversation.schema';
import { BlocksService } from '../blocks/blocks.service';
import { EventsService } from '../events/events.service';
import { SendDto } from '../gateway/ws.dto';
import { nextStatus, recipientsOf, statusAfterRead } from './message-status';
import { shapeConv } from '../conversations/conversations.service';
import { PageQuery, pageArgs, toPage } from '../common/pagination';

export function shapeMsg(msg: any) {
  if (!msg) return null;
  const id = msg.id ?? msg._id?.toString();
  return {
    id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    mediaUrls: msg.mediaUrls ?? [],
    status: msg.status ?? 'sent',
    readBy: msg.readBy ?? [],
    reactions: msg.reactions ?? [],
    createdAt: msg.createdAt,
  };
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    private blocks: BlocksService,
    private events: EventsService
  ) {}

  async assertMember(conversationId: string, userId: string): Promise<ConversationDocument> {
    const conv = await this.convModel.findById(conversationId);
    if (!conv) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });
    if (!conv.members.includes(userId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not a member of this conversation' });
    }
    return conv;
  }

  async send(senderId: string, dto: SendDto) {
    const conv = await this.assertMember(dto.conversationId, senderId);
    const recipients = recipientsOf(conv.members, senderId);
    await this.blocks.assertCanMessage(senderId, recipients);

    const msg = await this.messageModel.create({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      mediaUrls: dto.mediaUrls ?? [],
      status: 'sent',
      readBy: [],
      reactions: [],
    });

    conv.lastMessage = {
      id: msg._id.toString(),
      content: msg.content,
      senderId,
      createdAt: (msg as any).createdAt,
    };
    conv.hiddenFor = [];
    await conv.save();

    await this.events.publish('message.sent', {
      conversationId: dto.conversationId,
      senderId,
      recipientIds: recipients,
      preview: dto.content,
    });

    return {
      message: shapeMsg(msg),
      conversation: conv,
      recipients,
    };
  }

  async markDelivered(messageId: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) return null;
    const newStatus = nextStatus(msg.status, 'delivered');
    if (newStatus !== msg.status) {
      msg.status = newStatus;
      await msg.save();
    }
    return shapeMsg(msg);
  }

  async markRead(userId: string, conversationId: string, messageId: string) {
    await this.assertMember(conversationId, userId);
    const msg = await this.messageModel.findById(messageId);
    if (!msg) return null;

    const updated = statusAfterRead(msg.readBy, userId, msg.status);
    msg.status = updated.status;
    msg.readBy = updated.readBy;
    await msg.save();

    return {
      conversationId,
      messageId: msg._id.toString(),
      userId,
      readAt: new Date().toISOString(),
    };
  }

  async react(userId: string, messageId: string, emoji: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: 'Message not found' });
    await this.assertMember(msg.conversationId, userId);

    msg.reactions = msg.reactions.filter((r) => r.userId !== userId);
    msg.reactions.push({ userId, emoji, createdAt: new Date() });
    await msg.save();

    return {
      conversationId: msg.conversationId,
      messageId: msg._id.toString(),
      reactions: msg.reactions,
    };
  }

  async unreact(userId: string, messageId: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND', message: 'Message not found' });
    await this.assertMember(msg.conversationId, userId);

    msg.reactions = msg.reactions.filter((r) => r.userId !== userId);
    await msg.save();

    return {
      conversationId: msg.conversationId,
      messageId: msg._id.toString(),
      reactions: msg.reactions,
    };
  }

  async list(conversationId: string, userId: string, q: PageQuery) {
    await this.assertMember(conversationId, userId);

    const query: any = { conversationId };
    if (q.cursor) {
      query._id = { $lt: q.cursor };
    }

    const rows = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(q.limit + 1)
      .lean();

    const formatted = rows.map((r) => ({ ...shapeMsg(r), id: r._id.toString() }));
    const more = formatted.length > q.limit;
    const items = more ? formatted.slice(0, q.limit) : formatted;
    const nextCursor = more ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './conversation.schema';
import { BlocksService } from '../blocks/blocks.service';

export function shapeConv(conv: any) {
  if (!conv) return null;
  const id = conv.id ?? conv._id?.toString();
  return {
    id,
    type: conv.type ?? 'direct',
    members: conv.members ?? [],
    hiddenFor: conv.hiddenFor ?? [],
    lastMessage: conv.lastMessage ?? null,
    updatedAt: conv.updatedAt ?? conv.createdAt,
    createdAt: conv.createdAt,
  };
}

@Injectable()
export class ConversationsService {
  rooms: {
    join: (userId: string, conversationId: string) => void;
    leave: (userId: string, conversationId: string) => void;
    emitUpdated: (conversation: any) => void;
  } = {
    join: () => {},
    leave: () => {},
    emitUpdated: () => {},
  };

  constructor(
    @InjectModel(Conversation.name) private model: Model<ConversationDocument>,
    private blocks: BlocksService
  ) {}

  async idsForUser(userId: string): Promise<string[]> {
    const list = await this.model
      .find({ members: userId, hiddenFor: { $ne: userId } })
      .select('_id')
      .lean();
    return list.map((c) => c._id.toString());
  }

  async findOrCreateDirect(userId: string, otherUserId: string): Promise<any> {
    await this.blocks.assertCanMessage(userId, [otherUserId]);

    let conv = await this.model.findOne({
      type: 'direct',
      members: { $all: [userId, otherUserId], $size: 2 },
    });

    if (!conv) {
      conv = await this.model.create({
        type: 'direct',
        members: [userId, otherUserId],
        hiddenFor: [],
      });
      this.rooms.join(userId, conv._id.toString());
      this.rooms.join(otherUserId, conv._id.toString());
    } else if (conv.hiddenFor.includes(userId)) {
      conv.hiddenFor = conv.hiddenFor.filter((id) => id !== userId);
      await conv.save();
    }

    return shapeConv(conv);
  }

  async list(userId: string): Promise<any[]> {
    const list = await this.model
      .find({ members: userId, hiddenFor: { $ne: userId } })
      .sort({ updatedAt: -1 })
      .lean();
    return list.map(shapeConv);
  }

  async getById(id: string): Promise<any> {
    const conv = await this.model.findById(id).lean();
    if (!conv) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });
    return shapeConv(conv);
  }
}

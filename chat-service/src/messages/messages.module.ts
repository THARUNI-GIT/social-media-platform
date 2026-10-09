import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './message.schema';
import { Conversation, ConversationSchema } from '../conversations/conversation.schema';
import { MessagesService } from './messages.service';
import { BlocksModule } from '../blocks/blocks.module';
import { EventsService } from '../events/events.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    BlocksModule,
  ],
  providers: [MessagesService, EventsService],
  exports: [MessagesService, MongooseModule],
})
export class MessagesModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './conversation.schema';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { BlocksModule } from '../blocks/blocks.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Conversation.name, schema: ConversationSchema }]),
    BlocksModule,
    MessagesModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService, MongooseModule],
})
export class ConversationsModule {}

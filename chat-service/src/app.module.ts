import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlocksModule } from './blocks/blocks.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ChatGateway } from './gateway/chat.gateway';
import { PresenceService } from './redis/presence.service';
import { RedisService } from './redis/redis.service';
import { EventsService } from './events/events.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017/chat_db'),
    BlocksModule,
    ConversationsModule,
    MessagesModule,
  ],
  controllers: [HealthController],
  providers: [
    ChatGateway,
    PresenceService,
    RedisService,
    EventsService,
  ],
})
export class AppModule {}

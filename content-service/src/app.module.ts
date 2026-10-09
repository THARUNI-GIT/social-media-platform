import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';
import { EventsService } from './events/events.service';
import { UserClient } from './users/user-client.service';
import { FollowsConsumer } from './users/follows.consumer';
import { PostsController } from './posts/posts.controller';
import { CommentsController } from './posts/comments.controller';
import { PostsService } from './posts/posts.service';
import { ModerationModule } from './moderation/moderation.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ModerationModule],
  controllers: [PostsController, CommentsController, HealthController],
  providers: [
    PrismaService,
    EventsService,
    UserClient,
    FollowsConsumer,
    PostsService,
  ],
})
export class AppModule {}

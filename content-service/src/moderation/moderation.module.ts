import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
/** Import in AppModule. Needs PrismaService and EventsService to be exported/available (same ones PostsService injects). */
@Module({ controllers: [ModerationController], providers: [ModerationService] })
export class ModerationModule {}

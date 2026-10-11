import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  controllers: [ModerationController],
  providers: [ModerationService, PrismaService, EventsService],
})
export class ModerationModule {}

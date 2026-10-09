import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Ctx, HeaderAuthGuard, Me } from '../common/header-auth';
import { parseLimit } from '../common/pagination';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';

const pg = (q: any) => ({ cursor: q?.cursor, limit: parseLimit(q?.limit) });

@ApiTags('conversations')
@ApiHeader({ name: 'x-user-id' })
@Controller('conversations')
@UseGuards(HeaderAuthGuard)
export class ConversationsController {
  constructor(
    private readonly convs: ConversationsService,
    private readonly msgs: MessagesService
  ) {}

  @Post('direct/:otherUserId')
  @HttpCode(200)
  createDirect(@Me() m: Ctx, @Param('otherUserId') otherUserId: string) {
    return this.convs.findOrCreateDirect(m.userId, otherUserId);
  }

  @Get()
  list(@Me() m: Ctx) {
    return this.convs.list(m.userId);
  }

  @Get(':id/messages')
  listMessages(@Me() m: Ctx, @Param('id') id: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.msgs.list(id, m.userId, pg({ cursor, limit }));
  }
}

import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Ctx, HeaderAuthGuard, Me } from './common/header-auth';
import { NotificationsService } from './notifications.service';
const lim = (v: unknown) => Math.min(Math.max(parseInt(String(v ?? 20), 10) || 20, 1), 100);
@ApiTags('notifications') @ApiHeader({ name: 'x-user-id' }) @UseGuards(HeaderAuthGuard) @Controller('notifications')
export class NotificationsController {
  constructor(private n: NotificationsService) {}
  @Get() list(@Me() m: Ctx, @Query('cursor') cursor?: string, @Query('limit') limit?: string) { return this.n.list(m.userId, lim(limit), cursor); }
  @Get('unread-count') async unread(@Me() m: Ctx) { return { count: await this.n.unread(m.userId) }; }
  @Post('read-all') @HttpCode(200) readAll(@Me() m: Ctx) { return this.n.markAll(m.userId); }
  @Post(':id/read') @HttpCode(200) read(@Me() m: Ctx, @Param('id') id: string) { return this.n.markRead(m.userId, id); }
}

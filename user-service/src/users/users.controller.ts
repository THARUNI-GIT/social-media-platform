import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Ctx, HeaderAuthGuard, Me, Viewer } from '../common/header-auth';
import { parseLimit } from '../common/pagination';
import { BatchDto, PageDto, SearchDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';
const pg = (q: PageDto) => ({ cursor: q.cursor, limit: parseLimit(q.limit) });
@ApiTags('users') @ApiHeader({ name: 'x-user-id' }) @Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}
  @Get('me') @UseGuards(HeaderAuthGuard) me(@Me() m: Ctx) { return this.users.me(m.userId); }
  @Patch('me') @UseGuards(HeaderAuthGuard) update(@Me() m: Ctx, @Body() d: UpdateProfileDto) { return this.users.updateMe(m.userId, d); }
  @Get('search') @UseGuards(HeaderAuthGuard) search(@Me() m: Ctx, @Query() q: SearchDto) { return this.users.search(q.q, pg(q), m.userId); }
  @Get('me/blocks') @UseGuards(HeaderAuthGuard) blocks(@Me() m: Ctx, @Query() q: PageDto) { return this.users.blocks(m.userId, pg(q)); }
  /** Internal: used by content-service UserClient (service-to-service, not routed by gateway). */
  @Post('batch') @HttpCode(200) batch(@Body() d: BatchDto) { return this.users.batch(d.ids); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @Viewer() v: string | null) { return this.users.get(id, v); }
  @Post(':id/follow') @HttpCode(200) @UseGuards(HeaderAuthGuard) follow(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) { return this.users.follow(m.userId, id); }
  @Delete(':id/follow') @UseGuards(HeaderAuthGuard) unfollow(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) { return this.users.unfollow(m.userId, id); }
  @Post(':id/block') @HttpCode(200) @UseGuards(HeaderAuthGuard) block(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) { return this.users.block(m.userId, id); }
  @Delete(':id/block') @UseGuards(HeaderAuthGuard) unblock(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) { return this.users.unblock(m.userId, id); }
  @Get(':id/followers') followers(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageDto, @Viewer() v: string | null) { return this.users.followers(id, pg(q), v); }
  @Get(':id/following') following(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageDto, @Viewer() v: string | null) { return this.users.following(id, pg(q), v); }
}

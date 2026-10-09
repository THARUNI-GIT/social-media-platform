import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminGuard, Ctx, Me } from '../common/header-auth';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { parseLimit, toPage } from '../common/pagination';
import { toBrief } from './users.service';
/** Moderation module (user-service side): suspend/unsuspend accounts. Guarded by role "admin" (gateway also enforces). */
@ApiTags('admin') @ApiHeader({ name: 'x-user-roles', description: 'must include admin' }) @UseGuards(AdminGuard) @Controller('admin/users')
export class AdminController {
  constructor(private db: PrismaService, private events: EventsService) {}
  @Get('stats') async stats() { const [users, suspended] = await Promise.all([this.db.user.count(), this.db.user.count({ where: { suspendedAt: { not: null } } })]); return { users, suspended }; }
  @Get() async list(@Query('q') q?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const take = parseLimit(limit); const term = (q ?? '').trim().replace(/^@/, '');
    const rows = await this.db.user.findMany({ where: term ? { OR: [{ handle: { contains: term.toLowerCase() } }, { email: { contains: term.toLowerCase() } }, { displayName: { contains: term, mode: 'insensitive' } }] } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: take + 1, ...(cursor ? { cursor: { id: cursor } } : {}) });
    const page = toPage(rows, take); return { items: page.items.map((u) => ({ ...toBrief(u), email: u.email, roles: u.roles, suspended: !!u.suspendedAt })), nextCursor: page.nextCursor };
  }
  @Post(':id/suspend') @HttpCode(200) async suspend(@Me() a: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    if (id === a.userId) throw new BadRequestException({ code: 'SELF_SUSPEND', message: "Can't suspend yourself" });
    const u = await this.db.user.findUnique({ where: { id } }); if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    await this.db.user.update({ where: { id }, data: { suspendedAt: new Date() } });
    await this.db.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }); // existing access tokens live <=15 min
    await this.events.publish('user.suspended', { userId: id, by: a.userId }); return { id, suspended: true };
  }
  @Post(':id/unsuspend') @HttpCode(200) async unsuspend(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.user.update({ where: { id }, data: { suspendedAt: null } }).catch(() => { throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' }); });
    await this.events.publish('user.unsuspended', { userId: id }); return { id, suspended: false };
  }
}

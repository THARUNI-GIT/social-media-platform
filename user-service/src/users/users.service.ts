import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { PageQuery, pageArgs, toPage } from '../common/pagination';
import { UpdateProfileDto } from './users.dto';

type Counts = { followers: number; following: number };
export const toPublic = (u: User, c: Counts, isFollowing?: boolean) => ({
  id: u.id, handle: u.handle, displayName: u.displayName, bio: u.bio, avatarUrl: u.avatarUrl, verified: u.verified,
  followersCount: c.followers, followingCount: c.following, createdAt: u.createdAt, ...(isFollowing === undefined ? {} : { isFollowing }),
});
export const toSelf = (u: User, c: Counts) => ({ ...toPublic(u, c), email: u.email, roles: u.roles });
/** Shape consumed by content-service UserClient (`username` = handle). */
export const toBrief = (u: User) => ({ id: u.id, username: u.handle, handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl, verified: u.verified });

const notFound = () => new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
const liveUser = { suspendedAt: null } satisfies Prisma.UserWhereInput;

@Injectable()
export class UsersService {
  constructor(private db: PrismaService, private events: EventsService) {}

  private async counts(id: string): Promise<Counts> {
    const [followers, following] = await Promise.all([this.db.follow.count({ where: { followingId: id } }), this.db.follow.count({ where: { followerId: id } })]);
    return { followers, following };
  }
  private async user(id: string) { const u = await this.db.user.findFirst({ where: { id, ...liveUser } }); if (!u) throw notFound(); return u; }

  async me(id: string) { const u = await this.user(id); return toSelf(u, await this.counts(id)); }
  async updateMe(id: string, dto: UpdateProfileDto) {
    await this.user(id);
    const u = await this.db.user.update({ where: { id }, data: { displayName: dto.displayName?.trim(), bio: dto.bio, avatarUrl: dto.avatarUrl } });
    return toSelf(u, await this.counts(id));
  }
  async get(id: string, viewerId: string | null) {
    const u = await this.user(id);
    const isFollowing = viewerId ? !!(await this.db.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: id } } })) : undefined;
    return toPublic(u, await this.counts(id), isFollowing);
  }

  async batch(ids: string[]) { // missing/suspended ids are simply omitted; client falls back to {id}
    const rows = await this.db.user.findMany({ where: { id: { in: [...new Set(ids)] } } });
    return rows.map(toBrief);
  }

  async search(q: string, page: PageQuery, viewerId?: string) {
    const term = q.replace(/^@/, ''); const hidden = viewerId ? await this.hiddenIds(viewerId) : [];
    const rows = await this.db.user.findMany({
      where: { ...liveUser, ...(hidden.length ? { id: { notIn: hidden } } : {}), OR: [{ handle: { startsWith: term.toLowerCase() } }, { displayName: { contains: term, mode: 'insensitive' } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...pageArgs(page),
    });
    const { items, nextCursor } = toPage(rows, page.limit);
    return { items: items.map(toBrief), nextCursor };
  }

  // ---- moderation: blocks ----
  /** ids hidden from `me` in both directions (people I blocked + people who blocked me). */
  async hiddenIds(me: string): Promise<string[]> {
    const rows = await this.db.block.findMany({ where: { OR: [{ blockerId: me }, { blockedId: me }] } });
    return [...new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)))];
  }
  async block(me: string, target: string) {
    if (me === target) throw new BadRequestException({ code: 'SELF_BLOCK', message: "You can't block yourself" });
    await this.user(target);
    const { count } = await this.db.block.createMany({ data: [{ blockerId: me, blockedId: target }], skipDuplicates: true });
    // blocking severs the follow graph both ways
    const cut = await this.db.follow.deleteMany({ where: { OR: [{ followerId: me, followingId: target }, { followerId: target, followingId: me }] } });
    if (cut.count) { await this.events.publish('user.unfollowed', { followerId: me, followingId: target }); await this.events.publish('user.unfollowed', { followerId: target, followingId: me }); }
    if (count) await this.events.publish('user.blocked', { blockerId: me, blockedId: target, createdAt: new Date().toISOString() });
    return { userId: target, isBlocked: true };
  }
  async unblock(me: string, target: string) {
    const { count } = await this.db.block.deleteMany({ where: { blockerId: me, blockedId: target } });
    if (count) await this.events.publish('user.unblocked', { blockerId: me, blockedId: target });
    return { userId: target, isBlocked: false };
  }
  async blocks(me: string, page: PageQuery) {
    const rows = await this.db.block.findMany({ where: { blockerId: me }, include: { blocked: true }, orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }] });
    const users = rows.map((r) => r.blocked); const start = page.cursor ? Math.max(users.findIndex((u) => u.id === page.cursor), 0) : 0;
    const { items, nextCursor } = toPage(users.slice(start, start + page.limit + 1), page.limit);
    return { items: items.map(toBrief), nextCursor };
  }

  // ---- follow graph ----
  async follow(me: string, target: string) {
    if (me === target) throw new BadRequestException({ code: 'SELF_FOLLOW', message: "You can't follow yourself" });
    await this.user(target);
    const { count } = await this.db.follow.createMany({ data: [{ followerId: me, followingId: target }], skipDuplicates: true });
    if (count) await this.events.publish('user.followed', { followerId: me, followingId: target, createdAt: new Date().toISOString() });
    return { userId: target, isFollowing: true, followersCount: (await this.counts(target)).followers };
  }
  async unfollow(me: string, target: string) {
    const { count } = await this.db.follow.deleteMany({ where: { followerId: me, followingId: target } });
    if (count) await this.events.publish('user.unfollowed', { followerId: me, followingId: target });
    return { userId: target, isFollowing: false, followersCount: (await this.counts(target)).followers };
  }
  private async edge(id: string, dir: 'followers' | 'following', page: PageQuery, viewer: string | null) {
    await this.user(id);
    const rows = await this.db.follow.findMany({
      where: dir === 'followers' ? { followingId: id } : { followerId: id },
      include: { follower: true, following: true }, orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }, { followingId: 'desc' }],
    }); // composite PK: cursor by the other user's id
    const other = (r: (typeof rows)[number]) => (dir === 'followers' ? r.follower : r.following);
    const start = page.cursor ? Math.max(rows.findIndex((r) => other(r).id === page.cursor), 0) : 0;
    const slice = rows.slice(start, start + page.limit + 1);
    const users = slice.map(other).filter((u) => !u.suspendedAt);
    const viewerFollows = viewer && users.length ? new Set((await this.db.follow.findMany({ where: { followerId: viewer, followingId: { in: users.map((u) => u.id) } }, select: { followingId: true } })).map((f) => f.followingId)) : new Set<string>();
    const { items, nextCursor } = toPage(users, page.limit);
    return { items: items.map((u) => ({ ...toBrief(u), isFollowing: viewerFollows.has(u.id) })), nextCursor };
  }
  followers(id: string, page: PageQuery, viewer: string | null) { return this.edge(id, 'followers', page, viewer); }
  following(id: string, page: PageQuery, viewer: string | null) { return this.edge(id, 'following', page, viewer); }
}

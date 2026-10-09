import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { accessTtl, hashToken, newRefreshToken, signAccess } from './tokens';
import { toSelf } from '../users/users.service';

const bad = () => new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private events: EventsService) {}

  private async issue(u: { id: string; roles: string[] }) {
    const refreshToken = newRefreshToken();
    const days = parseInt(process.env.REFRESH_TTL_DAYS ?? '30', 10);
    await this.db.refreshToken.create({ data: { userId: u.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + days * 864e5) } });
    return { accessToken: signAccess(u.id, u.roles), refreshToken, expiresIn: accessTtl() };
  }

  async register(dto: RegisterDto) {
    const dup = await this.db.user.findFirst({ where: { OR: [{ email: dto.email }, { handle: dto.handle }] }, select: { email: true } });
    if (dup) throw new ConflictException({ code: 'USER_EXISTS', message: dup.email === dto.email ? 'Email already registered' : 'Handle taken' });
    const user = await this.db.user.create({ data: { email: dto.email, handle: dto.handle, displayName: dto.displayName.trim(), passwordHash: await argon2.hash(dto.password) } });
    await this.events.publish('user.registered', { userId: user.id, handle: user.handle, displayName: user.displayName, createdAt: user.createdAt });
    return { ...(await this.issue(user)), user: toSelf(user, { followers: 0, following: 0 }) };
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findFirst({ where: dto.identifier.includes('@') ? { email: dto.identifier } : { handle: dto.identifier } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw bad();
    if (user.suspendedAt) throw new UnauthorizedException({ code: 'ACCOUNT_SUSPENDED', message: 'Account suspended' });
    return { ...(await this.issue(user)), user: toSelf(user, await this.counts(user.id)) };
  }

  /** Rotation: old token is revoked on use. Reuse of a revoked token revokes every session (theft signal). */
  async refresh(token: string) {
    const row = await this.db.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!row) throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Invalid refresh token' });
    if (row.revokedAt) { await this.db.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException({ code: 'REFRESH_REUSED', message: 'Session revoked' }); }
    if (row.expiresAt < new Date() || row.user.suspendedAt) throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Refresh token expired' });
    const { count } = await this.db.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Invalid refresh token' });
    return this.issue(row.user);
  }

  async logout(token: string) {
    await this.db.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    return { loggedOut: true };
  }

  private async counts(id: string) {
    const [followers, following] = await Promise.all([this.db.follow.count({ where: { followingId: id } }), this.db.follow.count({ where: { followerId: id } })]);
    return { followers, following };
  }
}

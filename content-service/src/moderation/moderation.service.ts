import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { decide, AdminAction } from './rules';
const nf = (m: string) => new NotFoundException({ code: 'NOT_FOUND', message: m });
@Injectable()
export class ModerationService {
  constructor(private db: PrismaService, private events: EventsService) {}

  private async file(reporterId: string, targetType: 'post' | 'comment', targetId: string, reason: string, details?: string) {
    try { const r = await this.db.report.create({ data: { reporterId, targetType, targetId, reason, details } }); return { id: r.id, status: r.status }; }
    catch (e: any) { if (e?.code === 'P2002') throw new ConflictException({ code: 'ALREADY_REPORTED', message: 'You already reported this' }); throw e; }
  }
  async reportPost(userId: string, postId: string, reason: string, details?: string) {
    if (!(await this.db.post.findFirst({ where: { id: postId, deletedAt: null }, select: { id: true } }))) throw nf('Post not found');
    return this.file(userId, 'post', postId, reason, details);
  }
  async reportComment(userId: string, commentId: string, reason: string, details?: string) {
    if (!(await this.db.comment.findFirst({ where: { id: commentId, deletedAt: null }, select: { id: true } }))) throw nf('Comment not found');
    return this.file(userId, 'comment', commentId, reason, details);
  }
  async list(status: string, limit: number, cursor?: string) {
    const rows = await this.db.report.findMany({ where: { status: status as any }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor } } : {}) });
    const more = rows.length > limit; return { items: more ? rows.slice(0, limit) : rows, nextCursor: more ? rows[limit].id : null };
  }
  async resolve(adminId: string, id: string, action: AdminAction) {
    const rep = await this.db.report.findUnique({ where: { id } }); if (!rep) throw nf('Report not found');
    const { status, removeContent } = decide(action);
    await this.db.$transaction(async (tx) => {
      if (removeContent) {
        const now = new Date();
        if (rep.targetType === 'post') await tx.post.updateMany({ where: { id: rep.targetId, deletedAt: null }, data: { deletedAt: now } });
        else { const c = await tx.comment.findFirst({ where: { id: rep.targetId, deletedAt: null } });
          if (c) { await tx.comment.update({ where: { id: c.id }, data: { deletedAt: now } }); await tx.post.update({ where: { id: c.postId }, data: { commentsCount: { decrement: 1 } } }); } }
      }
      // resolve every open report on the same target
      await tx.report.updateMany({ where: { targetType: rep.targetType, targetId: rep.targetId, status: 'open' }, data: { status, resolvedBy: adminId, resolvedAt: new Date() } });
    });
    if (removeContent && rep.targetType === 'post') await this.events.publish('post.deleted', { postId: rep.targetId, authorId: null, moderated: true });
    return { id, status };
  }
  async stats() { const [open, posts] = await Promise.all([this.db.report.count({ where: { status: 'open' } }), this.db.post.count({ where: { deletedAt: null } })]); return { openReports: open, posts }; }
}

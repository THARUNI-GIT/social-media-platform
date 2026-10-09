import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../events/events.service';
import { UserClient } from '../users/user-client.service';
import { PageQuery, pageArgs, toPage } from '../common/pagination';
import { parseHashtags } from './hashtags';
import { buildVisibility } from './visibility';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

const withTags = { hashtags: { include: { hashtag: true } } } satisfies Prisma.PostInclude;
type PostRow = Prisma.PostGetPayload<{ include: typeof withTags }>;

@Injectable()
export class PostsService {
  constructor(private db: PrismaService, private events: EventsService, private users: UserClient) {}

  /** Visible = not deleted AND (public | own | followers-only for authors the viewer follows; follows replicated from user-service events). */
  private async visible(userId: string): Promise<Prisma.PostWhereInput> {
    const rows = await this.db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
    return buildVisibility(userId, rows.map((r) => r.followingId));
  }

  async create(userId: string, dto: CreatePostDto) {
    const tags = parseHashtags(dto.caption);
    const post = await this.db.$transaction(async (tx) => {
      const p = await tx.post.create({ data: { authorId: userId, caption: dto.caption, mediaUrls: dto.mediaUrls ?? [], visibility: (dto.visibility as any) ?? 'public' } });
      for (const tag of tags) {
        const h = await tx.hashtag.upsert({ where: { tag }, create: { tag, usageCount: 1 }, update: { usageCount: { increment: 1 } } });
        await tx.postHashtag.create({ data: { postId: p.id, hashtagId: h.id } });
      }
      return tx.post.findUniqueOrThrow({ where: { id: p.id }, include: withTags });
    });
    await this.events.publish('post.created', { postId: post.id, authorId: userId, caption: post.caption, tags: tags.map((t) => '#' + t), mediaUrls: post.mediaUrls, visibility: post.visibility, createdAt: post.createdAt });
    return (await this.serialize([post], userId))[0];
  }

  async get(id: string, userId: string) {
    const post = await this.db.post.findFirst({ where: { id, ...(await this.visible(userId)) }, include: withTags });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    return (await this.serialize([post], userId))[0];
  }

  async list(userId: string, q: PageQuery, authorId?: string) {
    const rows = await this.db.post.findMany({
      where: { ...(await this.visible(userId)), ...(authorId ? { authorId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: withTags, ...pageArgs(q),
    });
    const { items, nextCursor } = toPage(rows, q.limit);
    return { items: await this.serialize(items, userId), nextCursor };
  }

  private async own(id: string, userId: string) {
    const p = await this.db.post.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    if (p.authorId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Author only' });
    return p;
  }

  async update(id: string, userId: string, dto: UpdatePostDto) {
    await this.own(id, userId);
    await this.db.$transaction(async (tx) => {
      await tx.post.update({ where: { id }, data: { caption: dto.caption, visibility: dto.visibility as any } });
      if (dto.caption !== undefined) {
        await tx.postHashtag.deleteMany({ where: { postId: id } });
        for (const tag of parseHashtags(dto.caption)) {
          const h = await tx.hashtag.upsert({ where: { tag }, create: { tag, usageCount: 1 }, update: { usageCount: { increment: 1 } } });
          await tx.postHashtag.create({ data: { postId: id, hashtagId: h.id } });
        }
      }
    });
    return this.get(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.own(id, userId);
    await this.db.post.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.events.publish('post.deleted', { postId: id, authorId: userId });
    return { id, deleted: true };
  }

  // ---- reactions ----
  async react(postId: string, userId: string, reactionType: string) {
    const post = await this.db.post.findFirst({ where: { id: postId, ...(await this.visible(userId)) } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    const likesCount = await this.db.$transaction(async (tx) => {
      const key = { userId_targetType_targetId: { userId, targetType: 'post' as const, targetId: postId } };
      const existing = await tx.reaction.findUnique({ where: key });
      if (existing) { await tx.reaction.update({ where: key, data: { reactionType } }); return post.likesCount; }
      await tx.reaction.create({ data: { userId, targetType: 'post', targetId: postId, reactionType } });
      return (await tx.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } })).likesCount;
    });
    await this.events.publish('post.liked', { postId, authorId: post.authorId, userId, reactionType, likesCount });
    return { postId, isLiked: true, likes: likesCount };
  }

  async unreact(postId: string, userId: string) {
    const post = await this.db.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    const likes = await this.db.$transaction(async (tx) => {
      const { count } = await tx.reaction.deleteMany({ where: { userId, targetType: 'post', targetId: postId } });
      if (!count) return post.likesCount;
      return (await tx.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } })).likesCount;
    });
    return { postId, isLiked: false, likes };
  }

  // ---- share / bookmark ----
  async share(postId: string, userId: string, comment?: string) {
    const post = await this.db.post.findFirst({ where: { id: postId, ...(await this.visible(userId)) } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    const [share, updated] = await this.db.$transaction([
      this.db.share.create({ data: { postId, userId, comment } }),
      this.db.post.update({ where: { id: postId }, data: { sharesCount: { increment: 1 } } }),
    ]);
    await this.events.publish('post.shared', { shareId: share.id, postId, authorId: post.authorId, userId, comment: comment ?? null, sharesCount: updated.sharesCount });
    return { id: share.id, postId, shares: updated.sharesCount };
  }
  async bookmark(postId: string, userId: string) {
    const post = await this.db.post.findFirst({ where: { id: postId, ...(await this.visible(userId)) } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    await this.db.bookmark.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId }, update: {} });
    return { postId, isBookmarked: true };
  }
  async unbookmark(postId: string, userId: string) {
    await this.db.bookmark.deleteMany({ where: { userId, postId } });
    return { postId, isBookmarked: false };
  }
  async bookmarks(userId: string, q: PageQuery) {
    const rows = await this.db.bookmark.findMany({
      where: { userId, post: await this.visible(userId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { post: { include: withTags } }, ...pageArgs(q),
    });
    const { items, nextCursor } = toPage(rows, q.limit);
    return { items: await this.serialize(items.map((b) => b.post), userId), nextCursor };
  }

  async byHashtag(tag: string, userId: string, q: PageQuery) {
    const rows = await this.db.post.findMany({
      where: { ...(await this.visible(userId)), hashtags: { some: { hashtag: { tag: tag.replace(/^#/, '').toLowerCase() } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: withTags, ...pageArgs(q),
    });
    const { items, nextCursor } = toPage(rows, q.limit);
    return { items: await this.serialize(items, userId), nextCursor };
  }

  // ---- comments ----
  async addComment(postId: string, userId: string, content: string, parentCommentId?: string) {
    const post = await this.db.post.findFirst({ where: { id: postId, ...(await this.visible(userId)) } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    const comment = await this.db.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { postId, authorId: userId, content, parentCommentId: parentCommentId ?? null },
      });
      await tx.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
      return c;
    });
    await this.events.publish('comment.created', {
      commentId: comment.id,
      postId,
      postAuthorId: post.authorId,
      authorId: userId,
      content: comment.content,
    });
    const authors = await this.users.batch([userId]);
    return {
      id: comment.id,
      postId: comment.postId,
      author: UserClient.author(authors, userId),
      content: comment.content,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
    };
  }

  async listComments(postId: string, userId: string, q: PageQuery) {
    const post = await this.db.post.findFirst({ where: { id: postId, ...(await this.visible(userId)) } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    const rows = await this.db.comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...pageArgs(q),
    });
    const { items, nextCursor } = toPage(rows, q.limit);
    const authors = await this.users.batch(items.map((c) => c.authorId));
    return {
      items: items.map((c) => ({
        id: c.id,
        postId: c.postId,
        author: UserClient.author(authors, c.authorId),
        content: c.content,
        parentCommentId: c.parentCommentId,
        createdAt: c.createdAt,
      })),
      nextCursor,
    };
  }

  async deleteComment(postId: string, commentId: string, userId: string) {
    const comment = await this.db.comment.findFirst({ where: { id: commentId, postId, deletedAt: null }, include: { post: true } });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    if (comment.authorId !== userId && comment.post.authorId !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not authorized' });
    }
    await this.db.$transaction([
      this.db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      this.db.post.update({ where: { id: postId }, data: { commentsCount: { decrement: 1 } } }),
    ]);
    return { id: commentId, deleted: true };
  }

  async updateComment(commentId: string, userId: string, content: string) {
    const comment = await this.db.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    if (comment.authorId !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Author only' });
    }
    const updated = await this.db.comment.update({ where: { id: commentId }, data: { content } });
    return { id: updated.id, postId: updated.postId, content: updated.content, updatedAt: updated.updatedAt };
  }

  async deleteCommentDirect(commentId: string, userId: string) {
    const comment = await this.db.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    if (comment.authorId !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Author only' });
    }
    await this.db.$transaction([
      this.db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      this.db.post.update({ where: { id: comment.postId }, data: { commentsCount: { decrement: 1 } } }),
    ]);
    return { id: commentId, deleted: true };
  }

  async reactComment(commentId: string, userId: string, reactionType: string) {
    const comment = await this.db.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    const likesCount = await this.db.$transaction(async (tx) => {
      const key = { userId_targetType_targetId: { userId, targetType: 'comment' as const, targetId: commentId } };
      const existing = await tx.reaction.findUnique({ where: key });
      if (existing) { await tx.reaction.update({ where: key, data: { reactionType } }); return comment.likesCount; }
      await tx.reaction.create({ data: { userId, targetType: 'comment', targetId: commentId, reactionType } });
      return (await tx.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } })).likesCount;
    });
    return { commentId, isLiked: true, likes: likesCount };
  }

  // ---- serialization (API composition) ----
  async serialize(posts: PostRow[], userId: string) {
    if (!posts.length) return [];
    const ids = posts.map((p) => p.id);
    const [liked, recent] = await Promise.all([
      this.db.reaction.findMany({ where: { userId, targetType: 'post', targetId: { in: ids } }, select: { targetId: true } }),
      Promise.all(ids.map((postId) => this.db.comment.findMany({ where: { postId, parentCommentId: null, deletedAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 2 }))),
    ]);
    const likedSet = new Set(liked.map((r) => r.targetId));
    const authors = await this.users.batch([...posts.map((p) => p.authorId), ...recent.flat().map((c) => c.authorId)]);
    return posts.map((p, i) => ({
      id: p.id,
      author: UserClient.author(authors, p.authorId),
      caption: p.caption,
      tags: p.hashtags.map((h) => '#' + h.hashtag.tag),
      mediaUrls: p.mediaUrls as string[],
      visibility: p.visibility,
      likes: p.likesCount,
      isLiked: likedSet.has(p.id),
      commentsCount: p.commentsCount,
      comments: recent[i].map((c) => ({ id: c.id, user: authors.get(c.authorId)?.username ?? c.authorId, text: c.content })),
      createdAt: p.createdAt,
    }));
  }
}

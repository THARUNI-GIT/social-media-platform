export type NType = 'like' | 'comment' | 'share' | 'follow' | 'message';
export interface Draft { recipientId: string; type: NType; actorId: string; targetId?: string; groupKey?: string; preview?: string }
const clip = (s?: string) => (s ? (s.length > 80 ? s.slice(0, 77) + '...' : s) : undefined);
/** Maps an app.events message to zero or more notification drafts. Self-notifications are dropped.
 *  comment.created / message.sent payloads were not in the provided code: field names below are tolerant guesses (see PROGRESS.md). */
export function toDrafts(key: string, p: any): Draft[] {
  const out: Draft[] = [];
  switch (key) {
    case 'post.liked': out.push({ recipientId: p.authorId, type: 'like', actorId: p.userId, targetId: p.postId, groupKey: `like:${p.postId}` }); break;
    case 'post.shared': out.push({ recipientId: p.authorId, type: 'share', actorId: p.userId, targetId: p.postId, preview: clip(p.comment) }); break;
    case 'comment.created': out.push({ recipientId: p.postAuthorId ?? p.authorId_post ?? p.postOwnerId, type: 'comment', actorId: p.authorId ?? p.userId, targetId: p.postId, preview: clip(p.content ?? p.text) }); break;
    case 'user.followed': out.push({ recipientId: p.followingId, type: 'follow', actorId: p.followerId, targetId: p.followerId }); break;
    case 'message.sent': {
      const sender = p.senderId ?? p.userId;
      const rcpts: string[] = p.recipientIds ?? (p.recipientId ? [p.recipientId] : (p.participantIds ?? []).filter((x: string) => x !== sender));
      for (const r of rcpts) out.push({ recipientId: r, type: 'message', actorId: sender, targetId: p.conversationId, groupKey: `msg:${p.conversationId}`, preview: clip(p.preview ?? p.content) });
      break;
    }
  }
  return out.filter((d) => d.recipientId && d.actorId && d.recipientId !== d.actorId);
}
/** Cursor = base64(updatedAtMs_id) over sort [updatedAt desc, _id desc]. */
export const encodeCursor = (d: Date, id: string) => Buffer.from(`${d.getTime()}_${id}`).toString('base64url');
export function decodeCursor(c?: string): { t: Date; id: string } | null {
  if (!c) return null; const [ms, id] = Buffer.from(c, 'base64url').toString().split('_');
  return ms && id && !isNaN(+ms) ? { t: new Date(+ms), id } : null;
}

import { Prisma } from '@prisma/client';
/** Visible = not deleted AND (public | own | followers-only where viewer follows the author). */
export function buildVisibility(userId: string, followingIds: string[]): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    OR: [
      { visibility: 'public' }, { authorId: userId },
      ...(followingIds.length ? [{ visibility: 'followers' as const, authorId: { in: followingIds } }] : []),
    ],
  };
}

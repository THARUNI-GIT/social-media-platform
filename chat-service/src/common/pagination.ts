export interface PageQuery { cursor?: string; limit: number }
export const parseLimit = (v: unknown, d = 20) => Math.min(Math.max(parseInt(String(v ?? d), 10) || d, 1), 100);
export const pageArgs = (q: PageQuery) => ({ take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 0 } : {}) });
export function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const more = rows.length > limit; const items = more ? rows.slice(0, limit) : rows;
  return { items, nextCursor: more ? rows[limit].id : null };
}

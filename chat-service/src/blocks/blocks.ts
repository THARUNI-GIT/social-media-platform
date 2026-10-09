/** Pure helper: is there a block in either direction between a and b? `blocks` = set of "blocker>blocked". */
export const blockKey = (blocker: string, blocked: string) => `${blocker}>${blocked}`;
export const isBlockedEitherWay = (blocks: Set<string>, a: string, b: string) => blocks.has(blockKey(a, b)) || blocks.has(blockKey(b, a));

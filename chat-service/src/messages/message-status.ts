const RANKS: Record<string, number> = { sent: 0, delivered: 1, read: 2 };

export function canTransition(current: string, target: string): boolean {
  const c = RANKS[current] ?? 0;
  const t = RANKS[target] ?? 0;
  return t > c;
}

export function nextStatus(current: string, target: string): string {
  return canTransition(current, target) ? target : current;
}

export function recipientsOf(members: string[], senderId: string): string[] {
  return members.filter((m) => m !== senderId);
}

export function statusAfterRead(
  readBy: (string | { userId: string })[],
  readerId: string,
  currentStatus: string
): { status: string; readBy: string[] } {
  const set = new Set<string>();
  for (const item of readBy) {
    if (typeof item === 'string') set.add(item);
    else if (item && item.userId) set.add(item.userId);
  }
  set.add(readerId);
  const readByArray = Array.from(set);
  return {
    status: nextStatus(currentStatus, 'read'),
    readBy: readByArray,
  };
}

export function parseHashtags(caption: string): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  const unique = new Set(matches.map((m) => m.slice(1).toLowerCase()));
  return Array.from(unique);
}

export type AdminAction = 'remove' | 'dismiss';
/** What resolving a report does. */
export const decide = (a: AdminAction) => (a === 'remove' ? { status: 'resolved' as const, removeContent: true } : { status: 'dismissed' as const, removeContent: false });
export const REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'misinformation', 'other'] as const;

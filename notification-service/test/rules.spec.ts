import { decodeCursor, encodeCursor, toDrafts } from '../src/rules';
describe('notification rules', () => {
  it('skips self-notifications', () => {
    expect(toDrafts('post.liked', { postId: 'p', authorId: 'a', userId: 'a' })).toEqual([]);
    expect(toDrafts('user.followed', { followerId: 'a', followingId: 'a' })).toEqual([]);
  });
  it('likes get a per-post group key; follow targets the follower', () => {
    expect(toDrafts('post.liked', { postId: 'p', authorId: 'a', userId: 'b' })[0]).toMatchObject({ recipientId: 'a', actorId: 'b', groupKey: 'like:p' });
    expect(toDrafts('user.followed', { followerId: 'b', followingId: 'a' })[0]).toMatchObject({ recipientId: 'a', type: 'follow' });
  });
  it('message.sent fans out to recipients except sender', () => {
    const d = toDrafts('message.sent', { conversationId: 'c', senderId: 'a', participantIds: ['a', 'b', 'c2'] });
    expect(d.map((x) => x.recipientId)).toEqual(['b', 'c2']);
  });
  it('cursor round-trips', () => { const d = new Date(1700000000000); expect(decodeCursor(encodeCursor(d, 'abc'))).toEqual({ t: d, id: 'abc' }); expect(decodeCursor('###')).toBeNull(); });
});

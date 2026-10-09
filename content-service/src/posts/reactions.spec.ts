import { PostsService } from './posts.service';

describe('PostsService reactions logic', () => {
  let service: PostsService;
  let mockDb: any;
  let mockEvents: any;
  let mockUsers: any;

  beforeEach(() => {
    mockDb = {
      post: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      reaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      follow: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback) => callback(mockDb)),
    };
    mockEvents = { publish: jest.fn().mockResolvedValue(true) };
    mockUsers = { batch: jest.fn().mockResolvedValue(new Map()) };

    service = new PostsService(mockDb as any, mockEvents as any, mockUsers as any);
  });

  it('increments likes count and creates reaction when user reacts for the first time', async () => {
    mockDb.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'user-author', likesCount: 5 });
    mockDb.reaction.findUnique.mockResolvedValue(null);
    mockDb.post.update.mockResolvedValue({ likesCount: 6 });

    const result = await service.react('post-1', 'user-viewer', 'like');

    expect(result).toEqual({ postId: 'post-1', isLiked: true, likes: 6 });
    expect(mockDb.reaction.create).toHaveBeenCalledWith({
      data: { userId: 'user-viewer', targetType: 'post', targetId: 'post-1', reactionType: 'like' },
    });
    expect(mockEvents.publish).toHaveBeenCalledWith('post.liked', {
      postId: 'post-1',
      authorId: 'user-author',
      userId: 'user-viewer',
      reactionType: 'like',
      likesCount: 6,
    });
  });

  it('updates existing reaction type without incrementing likes count on duplicate react', async () => {
    mockDb.post.findFirst.mockResolvedValue({ id: 'post-1', authorId: 'user-author', likesCount: 6 });
    mockDb.reaction.findUnique.mockResolvedValue({ id: 'react-1', reactionType: 'like' });

    const result = await service.react('post-1', 'user-viewer', 'love');

    expect(result).toEqual({ postId: 'post-1', isLiked: true, likes: 6 });
    expect(mockDb.reaction.update).toHaveBeenCalled();
    expect(mockDb.post.update).not.toHaveBeenCalled();
  });

  it('decrements likes count when user unreacts', async () => {
    mockDb.post.findFirst.mockResolvedValue({ id: 'post-1', likesCount: 6 });
    mockDb.reaction.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.post.update.mockResolvedValue({ likesCount: 5 });

    const result = await service.unreact('post-1', 'user-viewer');

    expect(result).toEqual({ postId: 'post-1', isLiked: false, likes: 5 });
    expect(mockDb.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { likesCount: { decrement: 1 } },
    });
  });
});

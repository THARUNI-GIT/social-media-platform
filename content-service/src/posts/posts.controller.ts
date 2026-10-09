import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Ctx, HeaderAuthGuard, Me } from '../common/header-auth';
import { parseLimit } from '../common/pagination';
import { CreateCommentDto, CreatePostDto, ReactDto, ShareDto, UpdatePostDto } from './dto/post.dto';
import { PostsService } from './posts.service';

const pg = (q: any) => ({ cursor: q?.cursor, limit: parseLimit(q?.limit) });

@ApiTags('posts')
@ApiHeader({ name: 'x-user-id' })
@Controller('posts')
@UseGuards(HeaderAuthGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @HttpCode(201)
  create(@Me() m: Ctx, @Body() dto: CreatePostDto) {
    return this.posts.create(m.userId, dto);
  }

  @Get()
  list(@Me() m: Ctx, @Query('cursor') cursor?: string, @Query('limit') limit?: string, @Query('authorId') authorId?: string) {
    return this.posts.list(m.userId, pg({ cursor, limit }), authorId);
  }

  // STATIC ROUTES FIRST (before :id)
  @Get('bookmarks')
  bookmarks(@Me() m: Ctx, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.posts.bookmarks(m.userId, pg({ cursor, limit }));
  }

  @Get('hashtags/:tag')
  byHashtag(@Me() m: Ctx, @Param('tag') tag: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.posts.byHashtag(tag, m.userId, pg({ cursor, limit }));
  }

  // DYNAMIC ID ROUTES
  @Get(':id')
  get(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.get(id, m.userId);
  }

  @Patch(':id')
  update(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(id, m.userId, dto);
  }

  @Delete(':id')
  remove(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.remove(id, m.userId);
  }

  @Post(':id/reactions')
  @HttpCode(200)
  react(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactDto) {
    return this.posts.react(id, m.userId, dto?.reactionType ?? 'like');
  }

  @Delete(':id/reactions')
  unreact(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.unreact(id, m.userId);
  }

  @Post(':id/share')
  @HttpCode(200)
  share(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDto) {
    return this.posts.share(id, m.userId, dto?.comment);
  }

  @Post(':id/bookmark')
  @HttpCode(200)
  bookmark(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.bookmark(id, m.userId);
  }

  @Delete(':id/bookmark')
  unbookmark(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.unbookmark(id, m.userId);
  }

  // COMMENTS
  @Post(':id/comments')
  @HttpCode(201)
  addComment(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.posts.addComment(id, m.userId, dto.content, dto.parentCommentId);
  }

  @Get(':id/comments')
  listComments(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.posts.listComments(id, m.userId, pg({ cursor, limit }));
  }

  @Delete(':postId/comments/:id')
  deleteComment(@Me() m: Ctx, @Param('postId', ParseUUIDPipe) postId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.deleteComment(postId, id, m.userId);
  }
}

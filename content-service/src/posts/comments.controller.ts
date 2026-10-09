import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Ctx, HeaderAuthGuard, Me } from '../common/header-auth';
import { CreateCommentDto, ReactDto } from './dto/post.dto';
import { PostsService } from './posts.service';

@ApiTags('comments')
@ApiHeader({ name: 'x-user-id' })
@Controller('comments')
@UseGuards(HeaderAuthGuard)
export class CommentsController {
  constructor(private readonly posts: PostsService) {}

  @Patch(':id')
  updateComment(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.posts.updateComment(id, m.userId, dto.content);
  }

  @Delete(':id')
  deleteComment(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.posts.deleteCommentDirect(id, m.userId);
  }

  @Post(':id/reactions')
  @HttpCode(200)
  reactComment(@Me() m: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactDto) {
    return this.posts.reactComment(id, m.userId, dto?.reactionType ?? 'like');
  }
}

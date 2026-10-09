import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { Ctx, HeaderAuthGuard, Me } from './common/header-auth';
import { MediaService } from './media.service';
class PresignDto {
  @ApiProperty({ enum: ['avatar', 'post'] }) @IsIn(['avatar', 'post']) kind: 'avatar' | 'post';
  @ApiProperty({ example: 'image/png' }) @IsString() contentType: string;
  @ApiProperty({ description: 'bytes' }) @IsInt() @Min(1) @Max(50 * 1024 * 1024) size: number;
}
class DeleteDto { @ApiProperty({ example: 'post/<userId>/<uuid>.png' }) @IsString() key: string; }
@ApiTags('media') @ApiHeader({ name: 'x-user-id' }) @Controller()
export class MediaController {
  constructor(private m: MediaService) {}
  /** Returns { uploadUrl, fields, key, publicUrl }: POST multipart to uploadUrl with fields then the `file` part LAST. publicUrl goes in post mediaUrls / user avatarUrl. */
  @Post('media/uploads') @UseGuards(HeaderAuthGuard) presign(@Me() u: Ctx, @Body() d: PresignDto) { return this.m.presign(u.userId, d.kind, d.contentType, d.size); }
  @Delete('media') @UseGuards(HeaderAuthGuard) remove(@Me() u: Ctx, @Body() d: DeleteDto) { return this.m.remove(u.userId, d.key); }
  @Get('health') health() { return { status: 'ok' }; }
}

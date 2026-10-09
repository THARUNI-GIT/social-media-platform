import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @Length(1, 2200)
  caption: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({ enum: ['public', 'followers', 'private'] })
  @IsOptional()
  @IsIn(['public', 'followers', 'private'])
  visibility?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2200)
  caption?: string;

  @ApiPropertyOptional({ enum: ['public', 'followers', 'private'] })
  @IsOptional()
  @IsIn(['public', 'followers', 'private'])
  visibility?: string;
}

export class ReactDto {
  @ApiPropertyOptional({ default: 'like' })
  @IsOptional()
  @IsString()
  reactionType?: string;
}

export class ShareDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentCommentId?: string;
}

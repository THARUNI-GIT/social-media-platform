import { IsArray, IsOptional, IsString } from 'class-validator';

export class ConvDto {
  @IsString()
  conversationId: string;
}

export class SendDto {
  @IsString()
  conversationId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  clientTempId?: string;
}

export class ReadDto {
  @IsString()
  conversationId: string;

  @IsString()
  messageId: string;
}

export class ReactDto {
  @IsString()
  messageId: string;

  @IsString()
  emoji: string;
}

export class UnreactDto {
  @IsString()
  messageId: string;
}

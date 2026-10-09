import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Block, BlockSchema, BlocksService } from './blocks.service';
@Module({ imports: [MongooseModule.forFeature([{ name: Block.name, schema: BlockSchema }])], providers: [BlocksService], exports: [BlocksService] })
export class BlocksModule {}

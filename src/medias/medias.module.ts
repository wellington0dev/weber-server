import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { MediasController } from './medias.controller';
import { MediasService } from './medias.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediasController],
  providers: [MediasService],
})
export class MediasModule {}

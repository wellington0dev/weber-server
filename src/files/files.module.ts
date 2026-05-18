import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from 'src/medias/entities/media.entity';
import { FileItem } from './entities/file-item.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([FileItem, Media]),
  ],
  providers: [FilesService],
  controllers: [FilesController],
})
export class FilesModule {}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import YTDlpWrap from 'yt-dlp-wrap';
import { Media, MediaFormat } from './entities/media.entity';
import { DownloadMediaDto } from './dto/download-media.dto';

@Injectable()
export class MediasService {
  private readonly storageBase = path.resolve('./storage/medias');
  private readonly ytdlp = new YTDlpWrap('yt-dlp');

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async download(userId: number, dto: DownloadMediaDto): Promise<Media> {
    const ext = dto.format === 'audio' ? 'mp3' : 'mp4';
    const mimeType = dto.format === 'audio' ? 'audio/mpeg' : 'video/mp4';

    const userDir = path.join(this.storageBase, userId.toString());
    await fs.promises.mkdir(userDir, { recursive: true });

    let meta: any;
    try {
      const raw = await this.ytdlp.execPromise([
        dto.url, '--dump-json', '--no-playlist',
      ]);
      meta = JSON.parse(raw.trim());
    } catch (e: any) {
      throw new BadRequestException(
        `Cannot fetch media info: ${e.stderr ?? e.message ?? e}`,
      );
    }

    const mediaId = randomUUID();
    const filePath = path.join(userDir, `${mediaId}.${ext}`);

    const formatArgs: string[] =
      dto.format === 'audio'
        ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0']
        : ['-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]', '--merge-output-format', 'mp4'];

    try {
      await this.ytdlp.execPromise([
        dto.url,
        ...formatArgs,
        '-o', path.join(userDir, `${mediaId}.%(ext)s`),
        '--no-playlist',
      ]);
    } catch (e: any) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw new BadRequestException(
        `Download failed: ${e.stderr ?? e.message ?? e}`,
      );
    }

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat) {
      throw new BadRequestException('File not found after download.');
    }

    const media = this.mediaRepository.create({
      id: mediaId,
      userId,
      title: meta.title ?? 'Unknown',
      duration: meta.duration ?? null,
      format: dto.format as MediaFormat,
      mimeType,
      size: stat.size,
      filePath,
      sourceUrl: dto.url,
      thumbnail: meta.thumbnail ?? null,
    });

    try {
      return await this.mediaRepository.save(media);
    } catch (e) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw e;
    }
  }

  findAll(userId: number): Promise<Media[]> {
    return this.mediaRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: number, id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    if (media.userId !== userId) throw new ForbiddenException();
    return media;
  }

  async stream(userId: number, id: string, req: Request, res: Response): Promise<void> {
    const media = await this.findOne(userId, id);

    const stat = await fs.promises.stat(media.filePath).catch(() => null);
    if (!stat) throw new NotFoundException('File not found on disk');

    const size = stat.size;
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : size - 1;
      const chunkSize = end - start + 1;

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': media.mimeType,
      });

      fs.createReadStream(media.filePath, { start, end }).pipe(res);
    } else {
      res.set({
        'Content-Length': size,
        'Content-Type': media.mimeType,
        'Accept-Ranges': 'bytes',
      });

      fs.createReadStream(media.filePath).pipe(res);
    }
  }

  async export(userId: number, id: string, res: Response): Promise<void> {
    const media = await this.findOne(userId, id);

    const stat = await fs.promises.stat(media.filePath).catch(() => null);
    if (!stat) throw new NotFoundException('File not found on disk');

    const ext = media.filePath.split('.').pop();
    const filename = `${media.title.replace(/[^\w\s-]/g, '').trim()}.${ext}`;

    res.set({
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Type': media.mimeType,
      'Content-Length': stat.size,
    });

    fs.createReadStream(media.filePath).pipe(res);
  }

  async remove(userId: number, id: string): Promise<void> {
    const media = await this.findOne(userId, id);
    await fs.promises.unlink(media.filePath).catch(() => {});
    await this.mediaRepository.delete(id);
  }
}

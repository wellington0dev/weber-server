import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DownloadMediaDto } from './dto/download-media.dto';
import { MediasService } from './medias.service';

@UseGuards(JwtAuthGuard)
@Controller('medias')
export class MediasController {
  constructor(private readonly mediasService: MediasService) {}

  @Post()
  download(@Body() dto: DownloadMediaDto, @Req() req: any) {
    return this.mediasService.download(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.mediasService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.mediasService.findOne(req.user.id, id);
  }

  // token via query param: /medias/:id/stream?token=JWT
  @Get(':id/stream')
  stream(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
    @Res() res: Response,
  ) {
    return this.mediasService.stream(req.user.id, id, req, res);
  }

  // token via query param: /medias/:id/export?token=JWT
  @Get(':id/export')
  exportFile(
    @Param('id') id: string,
    @Req() req: Request & { user: any },
    @Res() res: Response,
  ) {
    return this.mediasService.export(req.user.id, id, res);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.mediasService.remove(req.user.id, id);
  }
}

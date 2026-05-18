import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateDirDto } from './dto/create-dir.dto';
import { FilesService } from './files.service';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  list(@Query('path') dirPath = '/', @Req() req: any) {
    return this.filesService.list(req.user.id, dirPath);
  }

  @Get('trash')
  listTrash(@Req() req: any) {
    return this.filesService.listTrash(req.user.id);
  }

  @Get('usage')
  usage(@Req() req: any) {
    return this.filesService.getUsage(req.user.id);
  }

  @Get('download/:id')
  async download(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { filePath, name, mimeType } = await this.filesService.getFilePath(req.user.id, id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: diskStorage({
        destination: (req: any, _file, cb) => {
          const userId = req.user?.id ?? 'unknown';
          const dirPath = (req.query?.path as string) ?? '/';
          const dest = path.join(
            process.cwd(),
            'storage',
            'files',
            String(userId),
            dirPath,
          );
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          cb(null, file.originalname);
        },
      }),
    }),
  )
  upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('path') dirPath = '/',
    @Req() req: any,
  ) {
    return this.filesService.registerUploads(req.user.id, dirPath, files);
  }

  @Post('mkdir')
  mkdir(@Body() dto: CreateDirDto, @Req() req: any) {
    return this.filesService.mkdir(req.user.id, dto.dirPath, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  trash(@Param('id') id: string, @Req() req: any) {
    return this.filesService.trash(req.user.id, id);
  }

  @Post('restore/:id')
  restore(@Param('id') id: string, @Req() req: any) {
    return this.filesService.restore(req.user.id, id);
  }

  @Delete('trash/:id')
  @HttpCode(204)
  permanentDelete(@Param('id') id: string, @Req() req: any) {
    return this.filesService.permanentDelete(req.user.id, id);
  }
}

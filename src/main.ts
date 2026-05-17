import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  fs.mkdirSync('./storage/medias', { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useStaticAssets(join(__dirname, '..', 'frontend'));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // 10-minute timeout for long downloads/streams
  app.getHttpServer().setTimeout(10 * 60 * 1000);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

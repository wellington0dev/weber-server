import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MediasModule } from './medias/medias.module';
import { User } from './users/entities/user.entity';
import { Media } from './medias/entities/media.entity';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Media],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    MediasModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})

export class AppModule {}
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
import { Conversation } from './chat/entities/conversation.entity';
import { ConversationMember } from './chat/entities/conversation-member.entity';
import { Message } from './chat/entities/message.entity';
import { ChatModule } from './chat/chat.module';
import { FileItem } from './files/entities/file-item.entity';
import { FilesModule } from './files/files.module';

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
      entities: [User, Media, Conversation, ConversationMember, Message, FileItem],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    MediasModule,
    ChatModule,
    FilesModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})

export class AppModule {}

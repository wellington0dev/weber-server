import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      const payload = this.jwtService.verify<{ sub: string; name?: string }>(token);

      let name = payload.name;
      if (!name) {
        const user = await this.userRepo.findOne({ where: { id: payload.sub as any } });
        name = user?.name ?? 'Usuário';
      }

      (client as any).user = { id: payload.sub, name };

      const rooms = await this.chatService.getUserRooms(payload.sub);
      for (const room of rooms) {
        await client.join(room);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const user = (client as any).user as { id: string; name: string };
    if (!user) return;

    const message = await this.chatService.saveMessage(
      user.id,
      user.name,
      data.conversationId,
      data.content,
    );

    this.server.to(data.conversationId).emit('new_message', message);
    return message;
  }

  @SubscribeMessage('join_conversation')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client as any).user as { id: string; name: string };
    if (!user) return;
    await this.chatService.assertAccess(user.id, data.conversationId);
    await client.join(data.conversationId);
  }
}

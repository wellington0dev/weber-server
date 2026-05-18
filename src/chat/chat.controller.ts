import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get('users')
  async getUsers() {
    const users = await this.userRepo.find({ order: { name: 'ASC' } });
    return users.map(({ password: _, ...u }) => u);
  }

  @Get('conversations')
  getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.id);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Req() req: any) {
    return this.chatService.getMessages(req.user.id, id);
  }

  @Post('conversations/direct')
  createDirect(@Body() body: { targetId: string }, @Req() req: any) {
    return this.chatService.createDirect(req.user.id, body.targetId);
  }

  @Post('conversations/group')
  createGroup(
    @Body() body: { name: string; memberIds: string[] },
    @Req() req: any,
  ) {
    return this.chatService.createGroup(req.user.id, body.name, body.memberIds);
  }
}

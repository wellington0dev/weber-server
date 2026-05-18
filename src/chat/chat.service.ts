import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepo: Repository<ConversationMember>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async onModuleInit() {
    const exists = await this.convRepo.findOne({
      where: { type: ConversationType.GLOBAL },
    });
    if (!exists) {
      await this.convRepo.save(
        this.convRepo.create({ type: ConversationType.GLOBAL, name: 'Geral' }),
      );
    }
  }

  async getGlobalConversation(): Promise<Conversation> {
    return this.convRepo.findOneOrFail({ where: { type: ConversationType.GLOBAL } });
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const global = await this.convRepo.findOne({ where: { type: ConversationType.GLOBAL } });
    const memberships = await this.memberRepo.find({ where: { userId } });
    const memberConvIds = memberships.map((m) => m.conversationId);

    const convs: Conversation[] = [];
    if (global) convs.push(global);

    if (memberConvIds.length > 0) {
      const others = await this.convRepo.find({ where: { id: In(memberConvIds) } });
      convs.push(...others.filter((c) => c.type !== ConversationType.GLOBAL));
    }

    return convs;
  }

  async getMessages(userId: string, conversationId: string, limit = 50): Promise<Message[]> {
    await this.assertAccess(userId, conversationId);
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async createDirect(creatorId: string, targetId: string): Promise<Conversation> {
    const existing = await this.findDirectBetween(creatorId, targetId);
    if (existing) return existing;

    const conv = await this.convRepo.save(
      this.convRepo.create({ type: ConversationType.DIRECT, createdBy: creatorId }),
    );
    await this.memberRepo.save([
      this.memberRepo.create({ conversationId: conv.id, userId: creatorId }),
      this.memberRepo.create({ conversationId: conv.id, userId: targetId }),
    ]);
    return conv;
  }

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
  ): Promise<Conversation> {
    const conv = await this.convRepo.save(
      this.convRepo.create({ type: ConversationType.GROUP, name, createdBy: creatorId }),
    );
    const allIds = Array.from(new Set([creatorId, ...memberIds]));
    await this.memberRepo.save(
      allIds.map((uid) => this.memberRepo.create({ conversationId: conv.id, userId: uid })),
    );
    return conv;
  }

  async saveMessage(
    userId: string,
    senderName: string,
    conversationId: string,
    content: string,
  ): Promise<Message> {
    await this.assertAccess(userId, conversationId);
    return this.messageRepo.save(
      this.messageRepo.create({ conversationId, userId, senderName, content }),
    );
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const global = await this.convRepo.findOne({ where: { type: ConversationType.GLOBAL } });
    const memberships = await this.memberRepo.find({ where: { userId } });
    const rooms = memberships.map((m) => m.conversationId);
    if (global && !rooms.includes(global.id)) rooms.unshift(global.id);
    return rooms;
  }

  async assertAccess(userId: string, conversationId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    if (conv.type === ConversationType.GLOBAL) return;
    const member = await this.memberRepo.findOne({ where: { conversationId, userId } });
    if (!member) throw new ForbiddenException('Sem acesso a esta conversa');
  }

  private async findDirectBetween(
    userA: string,
    userB: string,
  ): Promise<Conversation | null> {
    const mA = await this.memberRepo.find({ where: { userId: userA } });
    const mB = await this.memberRepo.find({ where: { userId: userB } });
    const idsA = new Set(mA.map((m) => m.conversationId));
    const shared = mB.filter((m) => idsA.has(m.conversationId));
    for (const m of shared) {
      const conv = await this.convRepo.findOne({
        where: { id: m.conversationId, type: ConversationType.DIRECT },
      });
      if (conv) return conv;
    }
    return null;
  }
}

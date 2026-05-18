import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity()
@Index(['conversationId', 'userId'], { unique: true })
export class ConversationMember {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  conversationId!: string;

  @Column()
  userId!: string;

  @CreateDateColumn()
  joinedAt!: Date;

  @ManyToOne(() => Conversation, (c) => c.members, { onDelete: 'CASCADE' })
  conversation!: Conversation;
}

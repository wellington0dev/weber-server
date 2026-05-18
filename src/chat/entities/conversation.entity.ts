import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ConversationMember } from './conversation-member.entity';
import { Message } from './message.entity';

export enum ConversationType {
  GLOBAL = 'global',
  GROUP = 'group',
  DIRECT = 'direct',
}

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ConversationType })
  type!: ConversationType;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => ConversationMember, (m) => m.conversation)
  members!: ConversationMember[];

  @OneToMany(() => Message, (m) => m.conversation)
  messages!: Message[];
}

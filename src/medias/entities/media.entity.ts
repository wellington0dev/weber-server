import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MediaFormat {
  VIDEO = 'video',
  AUDIO = 'audio',
}

const bigintTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseInt(v, 10),
};

@Index(['userId', 'createdAt'])
@Index(['userId', 'format'])
@Entity('medias')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: number;

  @Column()
  title!: string;

  @Column({ type: 'int', nullable: true })
  duration!: number | null;

  @Column({ type: 'enum', enum: MediaFormat })
  format!: MediaFormat;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  size!: number;

  @Column()
  filePath!: string;

  @Column({ type: 'text' })
  sourceUrl!: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnail!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

const bigintTransformer = {
  from: (v: string | null) => (v == null ? null : Number(v)),
  to: (v: number | null) => v,
};

@Entity()
@Index(['userId', 'dirPath'])
export class FileItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: number;

  @Column()
  name!: string;

  @Column({ default: '/' })
  dirPath!: string;

  @Column({ default: false })
  isDirectory!: boolean;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  size!: number | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'datetime', nullable: true })
  trashedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  originalDirPath!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

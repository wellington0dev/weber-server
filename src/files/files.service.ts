import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Media } from 'src/medias/entities/media.entity';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { FileItem } from './entities/file-item.entity';

const TRASH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB per user

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileItem)
    private readonly repo: Repository<FileItem>,
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
  ) {}

  // ── paths ────────────────────────────────────────────────────────────────

  private filesRoot(userId: number) {
    return path.join(process.cwd(), 'storage', 'files', String(userId));
  }

  private trashRoot(userId: number) {
    return path.join(process.cwd(), 'storage', 'trash', String(userId));
  }

  private physicalPath(userId: number, dirPath: string, name: string) {
    return path.join(this.filesRoot(userId), dirPath, name);
  }

  private trashPath(userId: number, id: string, name: string) {
    return path.join(this.trashRoot(userId), `${id}__${name}`);
  }

  // ── list ─────────────────────────────────────────────────────────────────

  async list(userId: number, dirPath: string) {
    const normalised = normPath(dirPath);
    const items = await this.repo.find({
      where: { userId, dirPath: normalised, trashedAt: IsNull() },
      order: { isDirectory: 'DESC', name: 'ASC' },
    });

    // Virtual "Mídias" entry at root
    if (normalised === '/') {
      const virtualMedias: Partial<FileItem> & { virtual: true } = {
        id: 'virtual-midias',
        name: 'Mídias',
        isDirectory: true,
        dirPath: '/',
        size: null,
        mimeType: null,
        createdAt: new Date(0),
        virtual: true,
      } as any;
      return [virtualMedias, ...items];
    }

    // Navigate into virtual Mídias
    if (normalised === '/Mídias') {
      return this.listMediasAsFiles(userId);
    }

    return items;
  }

  private async listMediasAsFiles(userId: number) {
    const medias = await this.mediaRepo.find({
      where: { userId: String(userId) as any },
      order: { createdAt: 'DESC' },
    });
    return medias.map((m) => ({
      id: `media-${m.id}`,
      name: `${m.title}${path.extname(m.filePath)}`,
      isDirectory: false,
      dirPath: '/Mídias',
      size: m.size,
      mimeType: m.mimeType,
      createdAt: m.createdAt,
      mediaId: m.id,
      virtual: true,
    }));
  }

  // ── mkdir ─────────────────────────────────────────────────────────────────

  async mkdir(userId: number, dirPath: string, name: string) {
    const normalised = normPath(dirPath);
    if (normalised.startsWith('/Mídias')) throw new BadRequestException('Pasta virtual somente leitura');

    const exists = await this.repo.findOne({
      where: { userId, dirPath: normalised, name, trashedAt: IsNull() },
    });
    if (exists) throw new BadRequestException('Já existe uma pasta com esse nome');

    const phys = this.physicalPath(userId, normalised, name);
    fs.mkdirSync(phys, { recursive: true });

    return this.repo.save(
      this.repo.create({ userId, name, dirPath: normalised, isDirectory: true, size: null }),
    );
  }

  // ── register uploaded files ───────────────────────────────────────────────

  async registerUploads(
    userId: number,
    dirPath: string,
    files: Express.Multer.File[],
  ) {
    const normalised = normPath(dirPath);
    if (normalised.startsWith('/Mídias')) throw new BadRequestException('Pasta virtual somente leitura');

    const records = files.map((f) =>
      this.repo.create({
        userId,
        name: f.originalname,
        dirPath: normalised,
        isDirectory: false,
        size: f.size,
        mimeType: f.mimetype,
      }),
    );
    return this.repo.save(records);
  }

  // ── download ──────────────────────────────────────────────────────────────

  async getFilePath(userId: number, id: string) {
    const item = await this.assertOwned(userId, id);
    if (item.isDirectory) throw new BadRequestException('Não é possível baixar uma pasta');
    const p = this.physicalPath(userId, item.dirPath, item.name);
    if (!fs.existsSync(p)) throw new NotFoundException('Arquivo não encontrado no disco');
    return { filePath: p, name: item.name, mimeType: item.mimeType };
  }

  // ── trash ─────────────────────────────────────────────────────────────────

  async trash(userId: number, id: string) {
    const item = await this.assertOwned(userId, id);

    const src = this.physicalPath(userId, item.dirPath, item.name);
    const dst = this.trashPath(userId, id, item.name);
    fs.mkdirSync(this.trashRoot(userId), { recursive: true });

    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }

    // For directories, mark all descendant DB records trashed too
    if (item.isDirectory) {
      await this.trashDescendants(userId, `${normPath(item.dirPath)}/${item.name}`);
    }

    item.originalDirPath = item.dirPath;
    item.trashedAt = new Date();
    item.dirPath = '/__trash__';
    return this.repo.save(item);
  }

  private async trashDescendants(userId: number, basePath: string) {
    const children = await this.repo.find({
      where: { userId, trashedAt: IsNull() },
    });
    const under = children.filter((c) => c.dirPath.startsWith(basePath));
    for (const child of under) {
      child.trashedAt = new Date();
      child.originalDirPath = child.dirPath;
      child.dirPath = '/__trash__';
    }
    if (under.length) await this.repo.save(under);
  }

  // ── trash list ────────────────────────────────────────────────────────────

  async listTrash(userId: number) {
    return this.repo.find({
      where: { userId, trashedAt: Not(IsNull()), dirPath: '/__trash__' },
      order: { trashedAt: 'DESC' },
    });
  }

  // ── restore ───────────────────────────────────────────────────────────────

  async restore(userId: number, id: string) {
    const item = await this.repo.findOne({ where: { id, userId } });
    if (!item || !item.trashedAt) throw new NotFoundException('Item não encontrado na lixeira');

    const src = this.trashPath(userId, id, item.name);
    const dst = this.physicalPath(userId, item.originalDirPath!, item.name);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (fs.existsSync(src)) fs.renameSync(src, dst);

    item.dirPath = item.originalDirPath!;
    item.originalDirPath = null;
    item.trashedAt = null;
    return this.repo.save(item);
  }

  // ── permanent delete ──────────────────────────────────────────────────────

  async permanentDelete(userId: number, id: string) {
    const item = await this.repo.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    const p = item.trashedAt
      ? this.trashPath(userId, id, item.name)
      : this.physicalPath(userId, item.dirPath, item.name);

    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
      else fs.unlinkSync(p);
    }

    await this.repo.delete({ id });
  }

  // ── usage ─────────────────────────────────────────────────────────────────

  async getUsage(userId: number) {
    const active = await this.repo.find({ where: { userId, trashedAt: IsNull(), isDirectory: false } });
    const trashed = await this.repo.find({ where: { userId, trashedAt: Not(IsNull()), isDirectory: false } });
    const usedBytes = active.reduce((s, f) => s + (f.size ?? 0), 0);
    const trashBytes = trashed.reduce((s, f) => s + (f.size ?? 0), 0);
    return { usedBytes, trashBytes, limitBytes: STORAGE_LIMIT_BYTES };
  }

  // ── scheduled cleanup ────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupTrash() {
    const cutoff = new Date(Date.now() - TRASH_MAX_AGE_MS);

    // Find all users with trash
    const trashed = await this.repo.find({
      where: { trashedAt: Not(IsNull()) },
    });

    const byUser = new Map<number, FileItem[]>();
    for (const item of trashed) {
      if (!byUser.has(item.userId)) byUser.set(item.userId, []);
      byUser.get(item.userId)!.push(item);
    }

    for (const [userId, items] of byUser) {
      // Delete items older than 7 days
      const expired = items.filter((i) => i.trashedAt! < cutoff);
      for (const item of expired) {
        await this.permanentDelete(userId, item.id);
      }

      // If still over limit, delete oldest trash first
      const remaining = items.filter((i) => i.trashedAt! >= cutoff);
      const usage = await this.getUsage(userId);
      if (usage.usedBytes + usage.trashBytes > STORAGE_LIMIT_BYTES) {
        const sorted = remaining.sort((a, b) => a.trashedAt!.getTime() - b.trashedAt!.getTime());
        let excess = usage.usedBytes + usage.trashBytes - STORAGE_LIMIT_BYTES;
        for (const item of sorted) {
          if (excess <= 0) break;
          excess -= item.size ?? 0;
          await this.permanentDelete(userId, item.id);
        }
      }
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async assertOwned(userId: number, id: string) {
    const item = await this.repo.findOne({ where: { id, userId, trashedAt: IsNull() } });
    if (!item) throw new NotFoundException('Arquivo não encontrado');
    return item;
  }
}

function normPath(p: string) {
  const n = '/' + p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return n === '/' ? '/' : n;
}

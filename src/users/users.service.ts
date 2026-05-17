import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }

  async create(dto: CreateUserDto) {
    const exists = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const count = await this.usersRepository.count();
    const accessLevel = count === 0 ? 1 : 2;

    const hash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      ...dto,
      password: hash,
      accessLevel,
    });

    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  async findAll() {
    const users = await this.usersRepository.find({
      order: { createdAt: 'ASC' },
    });
    return users.map(this.sanitize);
  }

  count() {
    return this.usersRepository.count();
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async updateAccessLevel(adminId: number, targetId: number, accessLevel: number) {
    if (adminId === targetId) {
      throw new ForbiddenException('Cannot change your own access level');
    }

    const target = await this.usersRepository.findOne({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.accessLevel === 1) {
      throw new ForbiddenException('Cannot change access level of another admin');
    }

    target.accessLevel = accessLevel;
    const saved = await this.usersRepository.save(target);
    return this.sanitize(saved);
  }

  private sanitize(user: User) {
    const { password, ...safe } = user;
    return safe;
  }
}

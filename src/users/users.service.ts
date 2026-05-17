import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

  async create(
    dto: CreateUserDto
  ) {

    const exists =
      await this.usersRepository.findOne({
        where: {
          email: dto.email,
        },
      });

    if (exists) {
      throw new BadRequestException(
        'Email already exists'
      );
    }

    const hash = await bcrypt.hash(
      dto.password,
      10
    );

    const user =
      this.usersRepository.create({
        ...dto,
        password: hash,
      });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

}

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async login(email: string, password: string) {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const token = this.jwtService.sign({
            sub: user.id,
            email: user.email,
            accessLevel: user.accessLevel,
        });

        const { password: _, ...safeUser } = user;

        return { token, user: safeUser };
    }

    async register(dto: CreateUserDto) {
        const count = await this.usersService.count();
        if (count > 0) {
            throw new ForbiddenException('Registration is closed. Contact an admin.');
        }
        return this.usersService.create(dto);
    }

    async status() {
        const count = await this.usersService.count();
        return { bootstrapped: count > 0 };
    }
}

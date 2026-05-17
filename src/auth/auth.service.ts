import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,

        private jwtService: JwtService,
    ) { }

    async login(
        email: string,
        password: string
    ) {

        const user =
            await this.usersService.findByEmail(
                email
            );

        if (!user) {
            throw new UnauthorizedException(
                'Invalid credentials'
            );
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {
            throw new UnauthorizedException(
                'Invalid credentials'
            );
        }

        const token =
            this.jwtService.sign({
                sub: user.id,
                email: user.email,
            });

        return {
            token,
            user,
        };
    }
}

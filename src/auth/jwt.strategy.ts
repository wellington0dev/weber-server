import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // allows <video src="/medias/:id/stream?token=JWT">
        (req: Request) => (req?.query?.token as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  validate(payload: { sub: number; email: string; accessLevel: number }) {
    return {
      id: payload.sub,
      email: payload.email,
      accessLevel: payload.accessLevel,
    };
  }
}

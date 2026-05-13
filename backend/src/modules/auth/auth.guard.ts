import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RedisService } from '../../providers/redis/redis.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private redisService: RedisService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    if (request.method === 'OPTIONS') {
      return true;
    }
    const token = this.extractTokenFromHeader(request);

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET
        });
        request['user'] = payload;
      } catch (err) {
        if (!isPublic) throw new UnauthorizedException();
      }
    }

    if (isPublic) {
      return true;
    }

    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET environment variable is missing.');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET
      });

      // RED TEAM FIX: Re-verify account status with REDIS CACHING for performance
      const cacheKey = `user:status:${payload.sub}`;
      let isActive = await this.redisService.get(cacheKey);

      if (isActive === null) {
        const { db } = await import('../../database/db');
        const { users } = await import('../../database/schema');
        const { eq } = await import('drizzle-orm');

        const [user] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, payload.sub)).limit(1);

        if (!user || !user.isActive) {
          await this.redisService.set(cacheKey, 'false', 'EX', 300); // Cache negative for 5m
          throw new UnauthorizedException('Account inactive or revoked.');
        }

        await this.redisService.set(cacheKey, 'true', 'EX', 300); // Cache positive for 5m
        isActive = 'true';
      }

      if (isActive === 'false') {
        throw new UnauthorizedException('Account inactive or revoked.');
      }

      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // 1. Check Header
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer') return token;

    // 2. Check HttpOnly Cookie
    if (request.cookies && request.cookies['ernad_session']) {
      return request.cookies['ernad_session'];
    }

    return undefined;
  }
}

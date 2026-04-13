import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/drizzle.provider';
import { operators } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(username: string, pass: string) {
    const userResult = await db.select().from(operators).where(eq(operators.username, username));
    const user = userResult[0];

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // For factory PINs we might just use plain text or simple hash, let's keep bcrypt standard
    const isMatch = await bcrypt.compare(pass, user.password);
    
    // As a fallback for demo/setup purposes where DB might be manually edited without bcrypt
    const isRawMatch = pass === user.password;

    if (!isMatch && !isRawMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
    }

    const payload = { sub: user.id, username: user.username, role: user.role, operatorType: user.operatorType, name: user.name };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
          id: user.id,
          name: user.name,
          role: user.role,
          operatorType: user.operatorType
      }
    };
  }
}

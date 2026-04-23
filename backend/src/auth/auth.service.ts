import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/db';
import { users, operatorSessions } from '../db/schema';
import { eq, ilike, and, isNull, sql, or } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private jwtService: JwtService) {}

  async login(identity: string, credential: string, type?: 'PASSWORD' | 'PIN') {
    const userResult = await db.select().from(users).where(
      or(
        ilike(users.username, identity),
        ilike(users.email, identity)
      )
    );
    const user = userResult[0];

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let isMatch = false;

    // ─── Intelligent Auto-Detection Logic ───
    if (type) {
      // User specified which mode to use
      if (type === 'PASSWORD') {
        if (!user.passwordHash) throw new UnauthorizedException('No password set for this account. Try PIN.');
        isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
      } else {
        if (!user.pinCode) throw new UnauthorizedException('No PIN set for this account. Try Password.');
        isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
      }
    } else {
      // Automated Mode: Try Password first, then PIN
      if (user.passwordHash) {
        isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
      }
      
      if (!isMatch && user.pinCode) {
        isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
      }
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account deactivated.');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        jobTitle: user.jobTitle,
        department: user.department,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async startOperatorSession(userId: string, lineId: string, shiftId: string) {
    this.logger.log(`Starting session for user ${userId} on line ${lineId}`);
    
    // Close existing open sessions
    await db.update(operatorSessions)
      .set({ logoutTime: new Date() })
      .where(and(eq(operatorSessions.userId, userId), isNull(operatorSessions.logoutTime)));

    const result = await db.insert(operatorSessions).values({
      userId,
      lineId,
      shiftId,
      loginTime: new Date(),
    }).returning();

    return result[0];
  }

  async logoutOperatorSession(userId: string) {
    await db.update(operatorSessions)
      .set({ logoutTime: new Date() })
      .where(and(eq(operatorSessions.userId, userId), isNull(operatorSessions.logoutTime)));
    
    return { success: true };
  }

  async resetCredentialById(adminRole: string, userId: string, newCredential: string, type: 'PASSWORD' | 'PIN') {
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(adminRole)) {
      throw new ForbiddenException('Unauthorized to reset credentials');
    }

    const hashed = await bcrypt.hash(newCredential, 10);
    const updateField = type === 'PASSWORD' ? { passwordHash: hashed } : { pinCode: hashed };

    await db.update(users)
      .set(updateField)
      .where(eq(users.id, userId));

    return { success: true, message: `${type} updated successfully` };
  }
}

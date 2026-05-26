import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { db } from '../../../database/db';
import { users } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);

  async findAll() {
    return [];
  }

  /**
   * Activate a terminal for a shift
   */
  async activateTerminal(terminalCode: string, supervisorId: string, shiftId: string) {
    throw new NotFoundException(`Terminal ${terminalCode} is not registered because terminal tables are disabled.`);
  }

  /**
   * Verify operator PIN for a specific action on a terminal
   */
  async verifyOperatorForAction(operatorId: string, pin: string) {
    const [user] = await db.select().from(users).where(eq(users.id, operatorId)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid or inactive operator.');

    const isPinValid = await bcrypt.compare(pin, user.pinCode);
    if (!isPinValid) throw new UnauthorizedException('Invalid PIN code.');

    return user;
  }

  /**
   * Get active terminal session
   */
  async getActiveSession(terminalId: string) {
    return null;
  }

  /**
   * Heartbeat to keep terminal online
   */
  async heartbeat(terminalId: string) {
    return { success: false };
  }
}

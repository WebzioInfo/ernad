import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '../../../database/db';
import { terminals, terminalSessions, users } from '../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);

  /**
   * Activate a terminal for a shift
   */
  async activateTerminal(terminalCode: string, supervisorId: string, shiftId: string) {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.code, terminalCode)).limit(1);
    if (!terminal) throw new NotFoundException(`Terminal ${terminalCode} not registered.`);

    return await db.transaction(async (tx) => {
      // Deactivate previous sessions
      await tx.update(terminalSessions)
        .set({ isActive: false, endTime: new Date() })
        .where(and(eq(terminalSessions.terminalId, terminal.id), eq(terminalSessions.isActive, true)));

      // Start new session
      const [session] = await tx.insert(terminalSessions).values({
        terminalId: terminal.id,
        supervisorId,
        shiftId,
        isActive: true,
      }).returning();

      await tx.update(terminals).set({ status: 'ONLINE', lastSeenAt: new Date() }).where(eq(terminals.id, terminal.id));

      return { terminal, session };
    });
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
    const [session] = await db.select()
      .from(terminalSessions)
      .where(and(eq(terminalSessions.terminalId, terminalId), eq(terminalSessions.isActive, true)))
      .limit(1);
    return session;
  }

  /**
   * Heartbeat to keep terminal online
   */
  async heartbeat(terminalId: string) {
    await db.update(terminals).set({ lastSeenAt: new Date() }).where(eq(terminals.id, terminalId));
  }
}

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { users, productionLines, shifts } from './schema';
import * as bcrypt from 'bcrypt';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function seed() {
  console.log('🏗️ Starting Personnel System "Big Makeover" Seed...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await client.connect();
    const db = drizzle(client);
    console.log('✅ Synchronized with Factory DB.');

    const passwordHash = await bcrypt.hash('password123', 10);
    const pinHash = await bcrypt.hash('1234', 10);

    const realisticStaff = [
      {
        name: 'Sarah Chen',
        username: 'sarah.chen',
        email: 'sarah.chen@ernad.com',
        phoneNumber: '+44 7700 900123',
        department: 'Plant Operations',
        jobTitle: 'Plant Manager',
        passwordHash,
        role: 'SUPER_ADMIN' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
      },
      {
        name: 'Marcus Rodriguez',
        username: 'marcus.admin',
        email: 'm.rodriguez@ernad.com',
        phoneNumber: '+44 7700 900456',
        department: 'IT & Infrastructure',
        jobTitle: 'System Architect',
        passwordHash,
        role: 'ADMIN' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      },
      {
        name: 'Aisha Patel',
        username: 'aisha.patel',
        email: 'aisha.patel@ernad.com',
        phoneNumber: '+44 7700 900789',
        department: 'Production',
        jobTitle: 'Shift Supervisor',
        passwordHash,
        role: 'MANAGER' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400',
      },
      {
        name: 'David Kim',
        username: 'david.kim',
        email: 'david.kim@ernad.com',
        phoneNumber: '+44 7700 900111',
        department: 'Blowing',
        jobTitle: 'Senior Technician',
        pinCode: pinHash,
        role: 'BLOWING_OPERATOR' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      },
      {
        name: 'Elena Rossi',
        username: 'elena.rossi',
        email: 'elena.r@ernad.com',
        phoneNumber: '+44 7700 900222',
        department: 'Labeling',
        jobTitle: 'Lead Operator',
        pinCode: pinHash,
        role: 'LABELING_OPERATOR' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      },
      {
        name: 'Michael Obina',
        username: 'michael.o',
        email: 'm.obina@ernad.com',
        department: 'Packing',
        jobTitle: 'Automation Specialist',
        pinCode: pinHash,
        role: 'PACKING_OPERATOR' as const,
        isActive: true,
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
      }
    ];

    console.log('🚀 Seeding comprehensive identity records...');
    for (const u of realisticStaff) {
      try {
        await db.insert(users).values(u).onConflictDoNothing();
        console.log(`   - Identity Created: ${u.name} (${u.jobTitle})`);
      } catch (e: any) {
        console.warn(`   ! Conflict for ${u.username}: ${e.message}`);
      }
    }

    // Seed Lines
    const lines = [
      { name: 'Line A (2L PET)', description: 'High-speed Carbonation Line', status: 'IDLE' },
      { name: 'Line B (500ml)', description: 'Still Water Line', status: 'IDLE' },
      { name: 'Line C (Can)', description: 'Canning Production', status: 'IDLE' },
    ];

    for (const l of lines) {
      await db.insert(productionLines).values(l).onConflictDoNothing();
    }
    console.log('✅ Production Lines Ready.');

    // Seed Shifts
    const shiftData = [
      { name: 'Alpha (Morning)', startTime: '06:00', endTime: '14:00' },
      { name: 'Beta (Afternoon)', startTime: '14:00', endTime: '22:00' },
      { name: 'Gamma (Night)', startTime: '22:00', endTime: '06:00' },
    ];

    for (const s of shiftData) {
      await db.insert(shifts).values(s).onConflictDoNothing();
    }
    console.log('✅ Shift Cycles Synchronized.');

    console.log('\n✨ Makeover Complete. Identity and Resources have been modernized.');
  } catch (err: any) {
    console.error('❌ Personnel Makeover failed:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed();

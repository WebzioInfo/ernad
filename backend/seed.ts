import { db } from './src/db/drizzle.provider';
import { operators } from './src/db/drizzle-schema';

async function seed() {
  console.log('Seeding demo accounts...');
  
  // Seed Super Admin
  await db.insert(operators).values({
    name: 'Admin User',
    username: 'admin',
    password: 'password', // in real app: bcrypt hash
    role: 'SUPER_ADMIN',
    isActive: true
  }).onConflictDoNothing();

  // Seed Filling Operator
  await db.insert(operators).values({
    name: 'John Filling',
    username: 'EMP-102',
    password: '1234',
    role: 'FILLING_OPERATOR',
    operatorType: 'FILLING',
    isActive: true
  }).onConflictDoNothing();

  console.log('Seeding complete! Try login with: admin / password OR EMP-102 / 1234');
  process.exit();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});

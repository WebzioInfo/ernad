import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UsersService } from './src/modules/users/users.service';
import { db } from './src/database/db';
import { users } from './src/database/schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  // Find a manager
  const managerResult = await db.execute(`
    SELECT u.id, u.name FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.slug = 'MANAGER'
    LIMIT 1
  `) as any;
  const manager = managerResult[0];
  if (!manager) {
    console.log("No manager found.");
    process.exit(0);
  }

  // Find an operator
  const opResult = await db.execute(`
    SELECT u.id, u.name FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.slug = 'OPERATOR'
    LIMIT 1
  `) as any;
  const operator = opResult[0];
  if (!operator) {
    console.log("No operator found.");
    process.exit(0);
  }

  console.log(`Manager ${manager.name} (${manager.id}) updating Operator ${operator.name} (${operator.id})`);

  try {
    const res = await usersService.updateOperator(manager.id, ['MANAGER'], operator.id, {
      name: operator.name + ' Edited',
      roles: ['OPERATOR']
    });
    console.log("Update succeeded:", res.name);
  } catch (err: any) {
    console.error("Update failed:", err.message);
  }

  await app.close();
}

bootstrap();

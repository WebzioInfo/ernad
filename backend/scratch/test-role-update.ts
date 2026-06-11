import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { db } from '../src/database/db';
import { users } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const adminQuery = await db.select().from(users).where(eq(users.username, 'admin.admin'));
  const admin = adminQuery[0];

  const managerQuery = await db.select().from(users).where(eq(users.username, 'pranesh.manager'));
  const manager = managerQuery[0];

  console.log(`Current manager roles BEFORE update:`);
  console.log(await usersService.getOperatorById(manager.id, admin.id, ['ADMIN']));

  // Update roles to JUST MANAGER
  await usersService.updateOperator(admin.id, ['ADMIN'], manager.id, {
    roles: ['MANAGER']
  });

  console.log(`Current manager roles AFTER update:`);
  console.log(await usersService.getOperatorById(manager.id, admin.id, ['ADMIN']));

  await app.close();
}

bootstrap();

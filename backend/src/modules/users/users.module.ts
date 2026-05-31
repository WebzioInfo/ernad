import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/roles.guard';
import { EventsModule } from '../../realtime/events.module';


@Module({
  imports: [EventsModule],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService, RolesGuard],
})
export class UsersModule {}

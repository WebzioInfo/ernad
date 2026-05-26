import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { TerminalsController } from './terminals.controller';
import { AuthService } from './auth.service';
import { OperatorSessionsModule } from '../operator-sessions/operator-sessions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
    OperatorSessionsModule,
    UsersModule,
  ],
  controllers: [AuthController, TerminalsController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { BiometricConnectionService } from './biometric-connection.service';
import { BiometricCronService } from './biometric-cron.service';
import { PayrollAttendanceService } from './payroll-attendance.service';

@Module({
  imports: [],
  controllers: [BiometricController],
  providers: [
    BiometricService,
    BiometricConnectionService,
    BiometricCronService,
    PayrollAttendanceService,
  ],
  exports: [BiometricService, PayrollAttendanceService],
})
export class BiometricModule {}

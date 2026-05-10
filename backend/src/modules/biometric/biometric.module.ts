import { Module } from '@nestjs/common';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { BiometricConnectionService } from './biometric-connection.service';
import { BiometricCronService } from './biometric-cron.service';
import { PayrollAttendanceService } from './payroll-attendance.service';

import { BiometricDebugController } from './biometric-debug.controller';
import { BiometricDebugService } from './biometric-debug.service';

@Module({
  imports: [],
  controllers: [BiometricController, BiometricDebugController],
  providers: [
    BiometricService,
    BiometricConnectionService,
    BiometricCronService,
    PayrollAttendanceService,
    BiometricDebugService,
  ],
  exports: [BiometricService, PayrollAttendanceService],
})
export class BiometricModule {}

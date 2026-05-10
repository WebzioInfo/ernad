import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BiometricDebugService } from './biometric-debug.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Biometric Debug')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('biometric/debug')
export class BiometricDebugController {
  constructor(private readonly debugService: BiometricDebugService) {}

  @Post('sync')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Diagnostic sync for a specific device' })
  async debugSync(@Body() body: { ip: string; port?: number }) {
    return await this.debugService.debugSync(body.ip, body.port || 4370);
  }
}

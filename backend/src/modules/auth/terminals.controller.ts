import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from './auth.guard';
import { Public } from './public.decorator';

@ApiTags('Terminals')
@Controller('terminals')
@UseGuards(AuthGuard)
export class TerminalsController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('operators')
  @ApiOperation({ summary: 'Get all active operators for terminal selection' })
  async getOperators() {
    return await this.usersService.getTerminalOperators();
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate operator via terminal PIN' })
  async terminalLogin(
    @Body() dto: { operatorId: string; pin: string; lineId: string; station: string; terminalId?: string }
  ) {
    return await this.authService.terminalLogin(
      dto.operatorId,
      dto.pin,
      dto.lineId,
      dto.station,
      dto.terminalId
    );
  }
}

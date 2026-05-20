import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus, BadRequestException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { TerminalService } from './services/terminal.service';
import { db } from '../../database/db';
import { terminals, factories } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { TerminalLoginDto } from '../auth/dto/auth.dto';

@ApiTags('Terminals')
@Controller('terminals')
export class TerminalsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly terminalService: TerminalService,
  ) {}

  @Public()
  @Get('operators')
  @ApiOperation({ summary: 'Get basic operator list for shared terminals' })
  async getTerminalOperators() {
    return await this.usersService.getTerminalOperators();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all registered terminals' })
  async getAllTerminals() {
    return await this.terminalService.findAll();
  }


  @Public()
  @Post('auth/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify operator PIN for shared terminal usage' })
  async terminalVerify(@Req() req: any, @Body() body: { userId: string; pin: string }) {
    return await this.authService.verifyTerminalPin(body.userId, body.pin);
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete Terminal Authentication (PIN Verify + Session Init + JWT)' })
  async terminalLogin(@Req() req: any, @Body() dto: TerminalLoginDto) {
    return await this.authService.terminalLogin(
      dto.operatorId, 
      dto.pin, 
      dto.lineId, 
      dto.station, 
      dto.terminalId
    );
  }





  @UseGuards(AuthGuard, RolesGuard)
  @Post('register')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Register a new factory terminal device' })
  async registerTerminal(@Body() dto: any) {
    const [factory] = await db.select().from(factories).limit(1);
    const [terminal] = await db.insert(terminals).values({
      ...dto,
      factoryId: factory.id,
      status: 'ONLINE',
    }).returning();
    return terminal;
  }

  @Get('state/:id')
  @ApiOperation({ summary: 'Get terminal state' })
  async getTerminal(@Param('id') id: string) {
    return await this.terminalService.getActiveSession(id); // Or detailed state
  }



  @Post('activate')
  @ApiOperation({ summary: 'Activate/Heartbeat a terminal' })
  async activateTerminal(@Body() dto: { code: string; supervisorId: string; shiftId: string }) {
    return await this.terminalService.activateTerminal(dto.code, dto.supervisorId, dto.shiftId);
  }
}

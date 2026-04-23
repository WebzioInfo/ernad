import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  Request,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { LoginDto, StartSessionDto, ResetCredentialDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Public — no guard. Returns JWT + user info.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate personnel with unified credentials' })
  async login(@Body() body: LoginDto) {
    if (!body.identity || !body.credential) {
      throw new UnauthorizedException('Identity signature and access credential are required');
    }
    return this.authService.login(body.identity, body.credential, body.type);
  }

  @UseGuards(AuthGuard)
  @Post('start-session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start an operator session on a production line' })
  async startSession(@Body() body: StartSessionDto, @Request() req) {
    return this.authService.startOperatorSession(req.user.sub, body.lineId, body.shiftId);
  }

  /**
   * GET /api/auth/me
   * Protected — returns the current user from the JWT payload.
   */
  @UseGuards(AuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile from JWT' })
  async getMe(@Request() req) {
    return req.user;
  }

  /**
   * PATCH /api/auth/reset-pin
   * Protected — Admin resets another operator's PIN by username.
   * Body: { targetUsername: string, newPin: string }
   */
  @UseGuards(AuthGuard)
  @Patch('reset-pin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset operator PIN (Admin only)' })
  async resetPin(
    @Request() req,
    @Body() body: { targetUsername: string; newPin: string },
  ) {
    // Note: resetCredentialById should be used instead of resetPin
    // For now, mapping this to the generic reset method if we had the userId
    // result would be: return this.authService.resetCredentialById(req.user.role, userId, body.newPin, 'PIN');
    throw new Error('resetPin by username is not implemented in AuthService. Use reset-credential with userId.');
  }

  /**
   * PATCH /api/auth/reset-pin-by-id
   * Protected — Admin resets another operator's PIN by ID.
   * Body: { operatorId: string, newPin: string }
   */
  @UseGuards(AuthGuard)
  @Patch('reset-credential')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset user credential (Admin only)' })
  async resetCredential(
    @Request() req,
    @Body() body: { userId: string; newCredential: string; type: 'PASSWORD' | 'PIN' },
  ) {
    return this.authService.resetCredentialById(req.user.role, body.userId, body.newCredential, body.type);
  }
}

import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('Username and password required');
    }
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return req.user;
  }
}

import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  @Get()
  root() {
    return {
      status: 'online',
      message: 'Ernad MES API is operational',
      timestamp: new Date().toISOString(),
      docs: '/api/docs'
    };
  }
}

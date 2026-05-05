import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users
   * Admin/Manager — List all operators (no passwords)
   */
  @Get()
  @Permissions('users:view')
  @ApiOperation({ summary: 'Get all operators (Admin/Manager)' })
  getAllOperators() {
    return this.usersService.getAllOperators();
  }

  /**
   * GET /api/users/audit-logs
   * Admin only — Get system audit logs
   */
  @Get('audit-logs')
  @Permissions('users:manage')
  @ApiOperation({ summary: 'Get system audit logs (Admin only)' })
  getAuditLogs() {
    return this.usersService.getAuditLogs();
  }

  /**
   * GET /api/users/:id
   * Admin/Manager — Get a single operator
   */
  @Get(':id')
  @Permissions('users:view')
  @ApiOperation({ summary: 'Get operator by ID (Admin/Manager)' })
  getOperatorById(@Param('id') id: string) {
    return this.usersService.getOperatorById(id);
  }

  /**
   * POST /api/users
   * Admin only — Create a new operator with bcrypt PIN
   */
  @Post()
  @Permissions('users:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new operator (Admin only)' })
  createOperator(@Body() dto: CreateUserDto) {
    return this.usersService.createOperator(dto);
  }

  /**
   * PATCH /api/users/:id
   * Admin only — Update operator details
   */
  @Patch(':id')
  @Permissions('users:manage')
  @ApiOperation({ summary: 'Update operator details (Admin only)' })
  updateOperator(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    console.log(`[UsersController] PATCH user ${id} with DTO:`, dto);
    return this.usersService.updateOperator(id, dto);
  }

  /**
   * PATCH /api/users/:id/toggle-active
   * Admin only — Toggle active/inactive status
   */
  @Patch(':id/toggle-active')
  @Permissions('users:manage')

  @ApiOperation({ summary: 'Toggle operator active status (Admin only)' })
  toggleActive(@Param('id') id: string) {
    return this.usersService.toggleActive(id);
  }

  /**
   * PATCH /api/users/:id/reset-pin
   * Admin only — Reset a user's PIN
   * Body: { newPin: string }
   */
  @Patch(':id/reset-pin')
  @Permissions('users:manage')

  @ApiOperation({ summary: 'Reset operator PIN (Admin only)' })
  resetPin(@Param('id') id: string, @Body() body: { newPin: string }) {
    return this.usersService.resetPin(id, body.newPin);
  }

  /**
   * POST /api/users/:id/avatar
   * Admin/Manager — Upload/Update personnel avatar
   */
  @Post(':id/avatar')
  @Permissions('users:manage')

  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload personnel avatar (Admin/Manager)' })
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.usersService.updateAvatar(id, file);
  }


  /**
   * DELETE /api/users/:id
   * Super Admin only — Permanently delete an operator
   */
  @Delete(':id')
  @Permissions('users:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete operator (Super Admin only)' })
  deleteOperator(@Param('id') id: string) {
    return this.usersService.deleteOperator(id);
  }
}

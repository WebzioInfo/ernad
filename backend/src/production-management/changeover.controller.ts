import { ChangeoverService } from './changeover.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Production Changeover')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('changeover')


export class ChangeoverController {
  constructor(private readonly changeoverService: ChangeoverService) {}

  @Post(':batchId/finish')
  @Permissions('production:close')

  async finishChangeover(
    @Param('batchId') batchId: string,
    @Body() dto: { leftoverMaterials: any; wastedMaterials: any }
  ) {
    return this.changeoverService.finishChangeover(batchId, dto.leftoverMaterials, dto.wastedMaterials);
  }
}

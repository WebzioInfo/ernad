import { Controller, Post, Body, Param } from '@nestjs/common';
import { ChangeoverService } from './changeover.service';

@Controller('api/changeover')
export class ChangeoverController {
  constructor(private readonly changeoverService: ChangeoverService) {}

  @Post(':batchId/finish')
  async finishChangeover(
    @Param('batchId') batchId: string,
    @Body() dto: { leftoverMaterials: any; wastedMaterials: any }
  ) {
    return this.changeoverService.finishChangeover(batchId, dto.leftoverMaterials, dto.wastedMaterials);
  }
}

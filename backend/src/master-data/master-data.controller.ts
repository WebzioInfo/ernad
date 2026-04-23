import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Master Data')
@ApiBearerAuth()
@Controller('api/master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('lines')
  async getLines() {
    return await this.masterDataService.getLines();
  }

  @Post('lines')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new production line' })
  async createLine(@Body() dto: { name: string; description?: string }) {
    return await this.masterDataService.createLine(dto);
  }

  @Patch('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a production line' })
  async updateLine(@Param('id') id: string, @Body() dto: any) {
    return await this.masterDataService.updateLine(id, dto);
  }

  @Delete('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a production line' })
  async deleteLine(@Param('id') id: string) {
    return await this.masterDataService.deleteLine(id);
  }


  @Get('shifts')
  async getShifts() {
    return await this.masterDataService.getShifts();
  }

  @Get('products')
  async getProducts() {
    return await this.masterDataService.getProducts();
  }

  @Get('current-shift')
  async getCurrentShift() {
    return await this.masterDataService.getCurrentShift();
  }

  @Get('brands')
  async getBrands() {
    return await this.masterDataService.getBrands();
  }
}

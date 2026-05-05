import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FactoryConfigService } from './factory-config.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { 
  CreateLineDto, 
  CreateBrandDto, 
  CreateProductDto, 
  CreateRawMaterialDto, 
  UpdateStockDto 
} from './dto/factory-config.dto';

@ApiTags('Factory Configuration')
@ApiBearerAuth()
@Controller('factory-config')
export class FactoryConfigController {
  constructor(private readonly factoryConfigService: FactoryConfigService) {}

  @Get('lines')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getLines(@Req() req: any) {
    return await this.factoryConfigService.getLines(req.user.factoryId);
  }

  @Post('lines')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Create a new production line' })
  async createLine(@Req() req: any, @Body() dto: CreateLineDto) {
    const factoryId = req.user.factoryId || (dto as any).factoryId;
    return await this.factoryConfigService.createLine(factoryId, dto);
  }

  @Patch('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Update a production line' })
  async updateLine(@Param('id') id: string, @Body() dto: any) {
    return await this.factoryConfigService.updateLine(id, dto);
  }

  @Delete('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Delete a production line' })
  async deleteLine(@Param('id') id: string) {
    return await this.factoryConfigService.deleteLine(id);
  }


  @Get('shifts')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getShifts(@Req() req: any) {
    return await this.factoryConfigService.getShifts(req.user.factoryId);
  }

  @Get('products')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getProducts(@Req() req: any) {
    return await this.factoryConfigService.getProducts(req.user.factoryId);
  }

  @Get('current-shift')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getCurrentShift() {
    return await this.factoryConfigService.getCurrentShift();
  }

  @Get('brands')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getBrands() {
    return await this.factoryConfigService.getBrands();
  }

  @Get('raw-materials')
  @UseGuards(RolesGuard)
  @Permissions('settings:view')
  async getRawMaterials(@Req() req: any) {
    return await this.factoryConfigService.getRawMaterials(req.user.factoryId);
  }

  @Post('raw-materials')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createRawMaterial(@Req() req: any, @Body() dto: CreateRawMaterialDto) {
    const factoryId = req.user.factoryId || (dto as any).factoryId;
    return await this.factoryConfigService.createRawMaterial(factoryId, dto);
  }

  @Post('raw-materials/stock')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('inventory:update')
  async updateStock(@Req() req: any, @Body() dto: UpdateStockDto) {
    const factoryId = req.user.factoryId || (dto as any).factoryId;
    return await this.factoryConfigService.updateStock(factoryId, dto);
  }

  @Post('brands')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createBrand(@Req() req: any, @Body() dto: CreateBrandDto) {
    return await this.factoryConfigService.createBrand(dto);
  }

  @Post('products')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createProduct(@Req() req: any, @Body() dto: CreateProductDto) {
    const factoryId = req.user.factoryId || (dto as any).factoryId;
    return await this.factoryConfigService.createProduct(factoryId, dto);
  }

  @Delete('shifts/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteShift(@Param('id') id: string) {
    return await this.factoryConfigService.deleteShift(id);
  }

  @Post('shifts')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createShift(@Req() req: any, @Body() dto: { name: string; startTime: string; endTime: string }) {
    const factoryId = req.user.factoryId || (dto as any).factoryId;
    return await this.factoryConfigService.createShift(factoryId, dto);
  }
}

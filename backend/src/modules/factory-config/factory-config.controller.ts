import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Logger } from '@nestjs/common';
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
@UseGuards(AuthGuard, RolesGuard)
@Controller(['factory-config', 'master-data'])
export class FactoryConfigController {
  private readonly logger = new Logger(FactoryConfigController.name);
  constructor(private readonly factoryConfigService: FactoryConfigService) {}

  @Get('lines')
  @Permissions('settings:view')
  async getLines() {
    return await this.factoryConfigService.getLines();
  }

  @Post('lines')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Create a new production line' })
  async createLine(@Body() dto: CreateLineDto) {
    return await this.factoryConfigService.createLine(dto);
  }

  @Patch('lines/:id')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Update a production line' })
  async updateLine(@Param('id') id: string, @Body() dto: any) {
    return await this.factoryConfigService.updateLine(id, dto);
  }

  @Delete('lines/:id')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Delete a production line' })
  async deleteLine(@Param('id') id: string) {
    return await this.factoryConfigService.deleteLine(id);
  }

  @Get('shifts')
  @Permissions('settings:view')
  async getShifts() {
    return await this.factoryConfigService.getShifts();
  }

  @Get('products')
  @Permissions('settings:view')
  async getProducts() {
    try {
      return await this.factoryConfigService.getProducts();
    } catch (err) {
      this.logger.error(`Failed to fetch products: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Get('current-shift')
  @Permissions('settings:view')
  async getCurrentShift() {
    return await this.factoryConfigService.getCurrentShift();
  }

  @Get('brands')
  @Permissions('settings:view')
  async getBrands() {
    return await this.factoryConfigService.getBrands();
  }

  @Get('raw-materials')
  @Permissions('settings:view')
  async getRawMaterials() {
    return await this.factoryConfigService.getRawMaterials();
  }

  @Post('raw-materials')
  @Permissions('settings:manage')
  async createRawMaterial(@Body() dto: CreateRawMaterialDto) {
    return await this.factoryConfigService.createRawMaterial(dto);
  }

  @Post('raw-materials/stock')
  @Permissions('inventory:update')
  async updateStock(@Body() dto: UpdateStockDto) {
    return await this.factoryConfigService.updateStock(dto);
  }

  @Post('brands')
  @Permissions('settings:manage')
  async createBrand(@Req() req: any, @Body() dto: CreateBrandDto) {
    return await this.factoryConfigService.createBrand(dto);
  }

  @Post('products')
  @Permissions('settings:manage')
  async createProduct(@Body() dto: CreateProductDto) {
    return await this.factoryConfigService.createProduct(dto);
  }

  @Delete('shifts/:id')
  @Permissions('settings:manage')
  async deleteShift(@Param('id') id: string) {
    return await this.factoryConfigService.deleteShift(id);
  }

  @Post('shifts')
  @Permissions('settings:manage')
  async createShift(@Body() dto: { name: string; startTime: string; endTime: string }) {
    return await this.factoryConfigService.createShift(dto);
  }
}

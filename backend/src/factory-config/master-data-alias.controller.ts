/**
 * Backward-compatibility alias for the /api/master-data/* routes.
 * The module was renamed from "master-data" to "factory-config" during the v3.0 refactor.
 * This controller keeps the old URL paths working until the frontend is updated.
 */
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FactoryConfigService } from './factory-config.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { 
  CreateLineDto,
  CreateBrandDto,
  CreateProductDto,
  CreateRawMaterialDto,
  CreateShiftDto,
  UpdateBrandDto, 
  UpdateProductDto, 
  UpdateRawMaterialDto,
  UpdateShiftDto,
  UpdateStockDto 
} from './dto/factory-config.dto';

@ApiTags('Master Data (Legacy Alias)')
@Controller('master-data')
export class MasterDataAliasController {
  constructor(private readonly factoryConfigService: FactoryConfigService) {
    console.log('MasterDataAliasController initialized');
  }

  @Get('factories')
  async getFactories() {
    return await this.factoryConfigService.getFactories();
  }

  @Get('lines')
  async getLines() {
    return await this.factoryConfigService.getLines();
  }

  @Get('shifts')
  async getShifts() {
    return await this.factoryConfigService.getShifts();
  }

  @Get('brands')
  async getBrands() {
    return await this.factoryConfigService.getBrands();
  }

  @Get('products')
  async getProducts() {
    return await this.factoryConfigService.getProducts();
  }

  @Get('raw-materials')
  async getRawMaterials() {
    return await this.factoryConfigService.getRawMaterials();
  }

  @Get('current-shift')
  async getCurrentShift() {
    return await this.factoryConfigService.getCurrentShift();
  }

  @Post('brands')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createBrand(@Req() req: any, @Body() dto: CreateBrandDto) {
    return await this.factoryConfigService.createBrand(dto);
  }

  @Patch('brands/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async updateBrand(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return await this.factoryConfigService.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteBrand(@Param('id') id: string) {
    return await this.factoryConfigService.deleteBrand(id);
  }

  @Post('products')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createProduct(@Req() req: any, @Body() dto: CreateProductDto & { factoryId?: string }) {
    const factoryId = req.user.factoryId || dto.factoryId;
    return await this.factoryConfigService.createProduct(factoryId, dto);
  }

  @Patch('products/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return await this.factoryConfigService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteProduct(@Param('id') id: string) {
    return await this.factoryConfigService.deleteProduct(id);
  }

  @Post('raw-materials')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createRawMaterial(@Req() req: any, @Body() dto: CreateRawMaterialDto & { factoryId?: string }) {
    const factoryId = req.user.factoryId || dto.factoryId;
    return await this.factoryConfigService.createRawMaterial(factoryId, dto);
  }

  @Patch('raw-materials/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async updateRawMaterial(@Param('id') id: string, @Body() dto: UpdateRawMaterialDto) {
    return await this.factoryConfigService.updateRawMaterial(id, dto);
  }

  @Delete('raw-materials/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteRawMaterial(@Param('id') id: string) {
    return await this.factoryConfigService.deleteRawMaterial(id);
  }

  @Post('raw-materials/stock')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('inventory:update')
  async updateStock(@Req() req: any, @Body() dto: UpdateStockDto & { factoryId?: string }) {
    const factoryId = req.user.factoryId || dto.factoryId;
    return await this.factoryConfigService.updateStock(factoryId, dto);
  }

  @Post('lines')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createLine(@Req() req: any, @Body() dto: CreateLineDto & { factoryId?: string }) {
    const factoryId = req.user.factoryId || dto.factoryId;
    return await this.factoryConfigService.createLine(factoryId, dto);
  }

  @Patch('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async updateLine(@Param('id') id: string, @Body() dto: any) {
    return await this.factoryConfigService.updateLine(id, dto);
  }

  @Delete('lines/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteLine(@Param('id') id: string) {
    return await this.factoryConfigService.deleteLine(id);
  }

  @Post('shifts')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async createShift(@Req() req: any, @Body() dto: CreateShiftDto & { factoryId?: string }) {
    const factoryId = req.user.factoryId || dto.factoryId;
    return await this.factoryConfigService.createShift(factoryId, dto);
  }

  @Patch('shifts/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async updateShift(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return await this.factoryConfigService.updateShift(id, dto);
  }

  @Delete('shifts/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('settings:manage')
  async deleteShift(@Param('id') id: string) {
    console.log('DELETE Shift hit with ID:', id);
    return await this.factoryConfigService.deleteShift(id);
  }
}


import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Logger, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { ShiftService } from './shift.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { 
  CreateLineDto, 
  CreateBrandDto, 
  CreateProductDto
} from './dto/master-data.dto';

@ApiTags('Master Data')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('master-data')
export class MasterDataController {
  private readonly logger = new Logger(MasterDataController.name);
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly shiftService: ShiftService
  ) {}

  @Get('lines')
  @UseGuards(AuthGuard)
  async getLines() {
    return await this.masterDataService.getLines();
  }

  @Get('lines/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a single production line' })
  async getLineById(@Param('id') id: string) {
    return await this.masterDataService.getLine(id);
  }

  @Post('lines')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Create a new production line' })
  async createLine(@Body() dto: CreateLineDto) {
    return await this.masterDataService.createLine(dto);
  }

  @Patch('lines/:id')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Update a production line' })
  async updateLine(@Param('id') id: string, @Body() dto: any) {
    return await this.masterDataService.updateLine(id, dto);
  }

  @Delete('lines/:id')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Delete a production line' })
  async deleteLine(@Param('id') id: string) {
    return await this.masterDataService.deleteLine(id);
  }

  @Get('products')
  @Permissions('settings:view')
  async getProducts() {
    try {
      return await this.masterDataService.getProducts();
    } catch (err) {
      this.logger.error(`Failed to fetch products: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Get('brands')
  @Permissions('settings:view')
  async getBrands() {
    return await this.masterDataService.getBrands();
  }

  @Post('brands')
  @Permissions('settings:manage')
  async createBrand(@Req() req: any, @Body() dto: CreateBrandDto) {
    return await this.masterDataService.createBrand(dto);
  }

  @Post('products')
  @Permissions('settings:manage')
  async createProduct(@Body() dto: CreateProductDto) {
    return await this.masterDataService.createProduct(dto);
  }

  @Get('shifts')
  @Permissions('settings:view')
  async getShifts() {
    return await this.shiftService.getShifts();
  }

  @Post('shifts')
  @Permissions('settings:manage')
  async createShift(@Body() dto: any) {
    return await this.shiftService.createShift(dto);
  }

  @Get('raw-materials')
  @Permissions('settings:view')
  async getRawMaterials() {
    return await this.masterDataService.getRawMaterials();
  }
}

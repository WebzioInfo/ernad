import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLineDto {
  @ApiProperty({ example: 'Line 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBrandDto {
  @ApiProperty({ example: 'Kenby' })
  @IsString()
  name: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Kenby 500ml' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty()
  @IsString()
  brandId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetBPM?: number;
}

export class CreateRawMaterialDto {
  @ApiProperty({ example: 'Preform' })
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  categoryId: string;
}

export class UpdateStockDto {
  @ApiProperty()
  @IsString()
  materialId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ enum: ['IN', 'OUT', 'ADJUSTMENT'] })
  @IsEnum(['IN', 'OUT', 'ADJUSTMENT'])
  type: 'IN' | 'OUT' | 'ADJUSTMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class UpdateBrandDto extends CreateBrandDto {}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetBPM?: number;
}

export class UpdateRawMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning' })
  @IsString()
  name: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  endTime: string;
}

export class UpdateShiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;
}


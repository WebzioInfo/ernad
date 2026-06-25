import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialUnit, MaterialType } from '../../../common/enums/material.enum';

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
  @IsEnum(MaterialType, { message: `materialType must be a valid MaterialType (${Object.values(MaterialType).join(', ')})` })
  materialType: string;

  @ApiProperty()
  @Transform(({ value }) => {
    if (!value) return value;
    const v = String(value).toUpperCase();
    if (v.includes('PCS') || v.includes('PIECE')) return MaterialUnit.PCS;
    if (v.includes('KG') || v.includes('KILOGRAM')) return MaterialUnit.KG;
    if (v.includes('BAG')) return MaterialUnit.BAG;
    if (v.includes('LTR') || v.includes('LITER')) return MaterialUnit.LTR;
    if (v.includes('BOX')) return MaterialUnit.BOX;
    if (v.includes('ROLL')) return MaterialUnit.ROLL;
    return value;
  })
  @IsEnum(MaterialUnit, { message: `unit must be a valid MaterialUnit (${Object.values(MaterialUnit).join(', ')})` })
  unit: string;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalProduced?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDispatched?: number;
}

export class UpdateRawMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MaterialType, { message: `materialType must be a valid MaterialType (${Object.values(MaterialType).join(', ')})` })
  materialType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const v = String(value).toUpperCase();
    if (v.includes('PCS') || v.includes('PIECE')) return MaterialUnit.PCS;
    if (v.includes('KG') || v.includes('KILOGRAM')) return MaterialUnit.KG;
    if (v.includes('BAG')) return MaterialUnit.BAG;
    if (v.includes('LTR') || v.includes('LITER')) return MaterialUnit.LTR;
    if (v.includes('BOX')) return MaterialUnit.BOX;
    if (v.includes('ROLL')) return MaterialUnit.ROLL;
    return value;
  })
  @IsEnum(MaterialUnit, { message: `unit must be a valid MaterialUnit (${Object.values(MaterialUnit).join(', ')})` })
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  currentStock?: number;
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


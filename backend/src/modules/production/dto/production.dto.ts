import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartBatchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  batchCode?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  targetQuantity?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  operatorIds?: string[];
}

export class ChangeoverDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toProductId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class QualityCheckDto {


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  inspectorId: string;

  @ApiProperty({ enum: ['PASS', 'FAIL'] })
  @IsEnum(['PASS', 'FAIL'])
  result: 'PASS' | 'FAIL';

  @ApiProperty()
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiProperty()
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class PackagingLogDto {


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  packType: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitsPerPack: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class DispatchLogDto {


  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  managerId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsOptional()
  vehicleNumber?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  remarks?: string;
}

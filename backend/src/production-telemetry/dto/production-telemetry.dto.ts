import { IsUUID, IsEnum, IsInt, IsDateString, Min, IsOptional, IsArray, IsNumber, IsString, ValidateNested, IsNotEmpty, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class MaterialUsageDto {
  @IsString()
  materialName: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  waste?: number;
}

export class ProductionTelemetryDto {
  @IsUUID()
  requestId: string;

  @IsUUID()
  batchId: string;

  @IsUUID()
  lineId: string;

  @IsUUID()
  @IsNotEmpty()
  brandId: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @IsEnum(['BLOWING', 'FILLING', 'LABELING', 'PACKING'])
  station: 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';

  @IsInt()
  @Min(0)
  primaryCount: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  splitValues?: number[];

  @IsInt()
  @Min(0)
  wastageCount: number;

  @IsOptional()
  @IsEnum(['POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END'])
  eventType?: 'POWER_FAILURE' | 'MACHINE_BREAKDOWN' | 'LOW_SPEED' | 'MATERIAL_SHORTAGE' | 'NORMAL_PRODUCTION' | 'BATCH_START' | 'BATCH_END';

  @IsOptional()
  @IsBoolean()
  isRework?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsageDto)
  materials?: MaterialUsageDto[];

  @IsDateString()
  @IsOptional()
  loggedAt?: string;
}


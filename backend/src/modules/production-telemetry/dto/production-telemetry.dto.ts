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
  @IsNotEmpty()
  sessionId: string;

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
  @IsEnum(['POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'DOWNTIME_PAUSE'])
  eventType?: 'POWER_FAILURE' | 'MACHINE_BREAKDOWN' | 'LOW_SPEED' | 'MATERIAL_SHORTAGE' | 'NORMAL_PRODUCTION' | 'BATCH_START' | 'BATCH_END' | 'DOWNTIME_PAUSE';

  @IsOptional()
  @IsBoolean()
  isRework?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsUUID()
  selectedStockId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsageDto)
  materials?: MaterialUsageDto[];

  // Enterprise Extensions
  @IsOptional() @IsInt() capUsage?: number;
  @IsOptional() @IsInt() capRejection?: number;
  @IsOptional() @IsInt() preformUsage?: number;
  @IsOptional() @IsInt() preformRejection?: number;
  @IsOptional() @IsNumber() bopRollUsage?: number;
  @IsOptional() @IsNumber() bopRejection?: number;
  @IsOptional() @IsNumber() shrinkWeightUsed?: number;
  @IsOptional() @IsNumber() shrinkWeightRejected?: number;
  @IsOptional() @IsInt() casesProduced?: number;
  @IsOptional() @IsUUID() packingTypeId?: string;
  @IsOptional() @IsInt() finishedGoodsProduced?: number;
  @IsOptional() @IsNumber() materialCost?: number;
  @IsOptional() @IsInt() boxCount?: number;

  @IsDateString()
  @IsOptional()
  loggedAt?: string;
}


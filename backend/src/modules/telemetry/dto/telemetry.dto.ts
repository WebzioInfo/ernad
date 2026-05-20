import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, IsEnum, IsArray, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelemetryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  factoryId?: string;

  @ApiProperty()
  @IsEnum(['BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC'])
  @IsNotEmpty()
  @IsString()
  station: 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING' | 'QC';

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  sessionId?: string; // Optional in hybrid mode

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  terminalId?: string; // New: Device tracing

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  operatorId?: string; // New: Quick attribution

  @ApiProperty()
  @IsString()
  @IsOptional()
  operatorPin?: string; // New: Action verification

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(1000000)
  primaryCount: number;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  splitValues?: number[];

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  wastageCount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1000000)
  capUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  capRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1000000)
  preformUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  preformRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  bopRollUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  bopRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  shrinkWeightUsed?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  shrinkWeightRejected?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  inkUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  solventUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1000000)
  finishedGoodsProduced?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  casesProduced?: number;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  selectedStockId?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isRework?: boolean;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  packingTypeId?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  materialCost?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000)
  boxCount?: number;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  materials?: any[];
  
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  phValue?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  tdsValue?: number;

  @ApiProperty()
  @IsEnum(['PASSED', 'FAILED', 'PENDING'])
  @IsOptional()
  testResult?: 'PASSED' | 'FAILED' | 'PENDING';

  @ApiProperty()
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  fromTime?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  toTime?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  secondaryPackagingCount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  labelStickerWeight?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  damagedLabelWeight?: number;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  inkChanged?: boolean;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  inkUsageMl?: number;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  makeupChanged?: boolean;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  makeupUsageMl?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  shrinkWasteWeight?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  sourceBatchNumber?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  loggedAt: string;
}

import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, IsEnum, IsArray, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProductionTelemetryDto {
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
  @IsNotEmpty()
  factoryId: string;

  @ApiProperty()
  @IsEnum(['BLOWING', 'FILLING', 'LABELING', 'PACKING'])
  @IsNotEmpty()
  station: 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';

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
  primaryCount: number;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  splitValues?: number[];

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  wastageCount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  capUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  capRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  preformUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  preformRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  bopRollUsage?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  bopRejection?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  shrinkWeightUsed?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  shrinkWeightRejected?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  finishedGoodsProduced?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
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
  boxCount?: number;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  materials?: any[];

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
  @IsNotEmpty()
  loggedAt: string;
}

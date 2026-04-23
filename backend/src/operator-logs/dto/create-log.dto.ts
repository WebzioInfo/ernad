import { IsUUID, IsEnum, IsInt, IsDateString, Min, IsOptional } from 'class-validator';

export class CreateLogDto {
  @IsUUID()
  requestId: string;

  @IsUUID()
  batchId: string;

  @IsUUID()
  lineId: string;

  @IsUUID()
  shiftId: string;

  @IsEnum(['BLOWING', 'FILLING', 'LABELING', 'PACKING'])

  station: 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';

  @IsInt()
  @Min(1)
  primaryCount: number;

  @IsInt()
  @Min(0)
  wastageCount: number;

  @IsDateString()
  @IsOptional()
  loggedAt?: string;
}

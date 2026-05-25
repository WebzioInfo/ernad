import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ example: 'line-uuid' })
  @IsUUID()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty({ example: 'FILLING' })
  @IsString()
  @IsNotEmpty()
  station: string;

  @ApiProperty({ example: 'shift-uuid', required: false })
  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  force?: boolean;
}

export class ShiftHandoverDto {
  @ApiProperty({ example: 'operator-uuid' })
  @IsUUID()
  @IsNotEmpty()
  incomingOperatorId: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  incomingOperatorPin: string;

  @ApiProperty({ example: 'Blowing heater zone 3 running warm, but within tolerances.', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 'No major pending issues.', required: false })
  @IsString()
  @IsOptional()
  pendingIssues?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  materialStateConfirmed: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  machineStatusAcknowledged: boolean;
}

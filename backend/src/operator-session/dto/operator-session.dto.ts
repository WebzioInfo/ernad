import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

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

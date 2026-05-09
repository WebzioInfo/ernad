import { IsString, IsInt, Min, Max, IsEnum, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  name: string;

  @ApiProperty({ example: '08:00:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: 'Time must be in HH:mm:ss format' })
  startTime: string;

  @ApiProperty({ example: '17:00:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: 'Time must be in HH:mm:ss format' })
  endTime: string;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(0)
  @Max(120)
  graceMinutes: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  overtimeAfter: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(12)
  minimumHours: number;

  @ApiProperty({ example: 'DAY', enum: ['DAY', 'NIGHT', 'GENERAL'] })
  @IsEnum(['DAY', 'NIGHT', 'GENERAL'])
  shiftType: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignShiftDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  shiftId: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  effectiveFrom: string;
}

import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, MinLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john.doe' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'john@ernad.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+254700000000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Filling Line' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Shift Lead' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @MinLength(4)
  pin: string;

  @ApiPropertyOptional({ example: ['OPERATOR'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: 'OPERATOR' })
  @IsOptional()
  @IsString()
  role?: string; 

  @ApiPropertyOptional({ example: 'BLOWING' })
  @IsOptional()
  @IsString()
  operatorType?: string;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedLines?: string[];
}

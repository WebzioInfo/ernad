import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    description: 'Username or professional staff email address',
    example: 'sarah.chen@ernad.com' 
  })
  @IsString()
  @IsNotEmpty()
  identity: string;

  @ApiProperty({ 
    description: 'Enterprise password or factory floor PIN code',
    example: 'password123' 
  })
  @IsString()
  @IsNotEmpty()
  credential: string;

  @ApiProperty({ 
    description: 'Explicit authentication type (optional, auto-detected if omitted)',
    enum: ['PASSWORD', 'PIN'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['PASSWORD', 'PIN'])
  type?: 'PASSWORD' | 'PIN';
}

export class StartSessionDto {
  @ApiProperty({ example: 'line1' })
  @IsString()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty({ example: 'shift1' })
  @IsString()
  @IsNotEmpty()
  shiftId: string;
}

export class ResetCredentialDto {
  @ApiProperty({ description: 'ID of the user to reset' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'New password or pin code' })
  @IsString()
  @IsNotEmpty()
  newCredential: string;

  @ApiProperty({ enum: ['PASSWORD', 'PIN'] })
  @IsEnum(['PASSWORD', 'PIN'])
  type: 'PASSWORD' | 'PIN';
}

export class TerminalLoginDto {
  @ApiProperty({ description: 'Operator UUID' })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({ description: 'Operator PIN' })
  @IsString()
  @IsNotEmpty()
  pin: string;

  @ApiProperty({ description: 'Production Line UUID' })
  @IsString()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty({ description: 'Station Name (BLOWING, FILLING, etc.)' })
  @IsString()
  @IsNotEmpty()
  station: string;

  @ApiProperty({ description: 'Terminal ID (Optional for flexible auth)' })
  @IsString()
  @IsOptional()
  terminalId?: string;
}



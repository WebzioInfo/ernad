import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'Username or professional staff email address',
    example: 'sarah.chen@ernad.com' 
  })
  identity: string;

  @ApiProperty({ 
    description: 'Enterprise password or factory floor PIN code',
    example: 'password123' 
  })
  credential: string;

  @ApiProperty({ 
    description: 'Explicit authentication type (optional, auto-detected if omitted)',
    enum: ['PASSWORD', 'PIN'],
    required: false 
  })
  type?: 'PASSWORD' | 'PIN';
}

export class StartSessionDto {
  @ApiProperty({ example: 'line1' })
  lineId: string;

  @ApiProperty({ example: 'shift1' })
  shiftId: string;
}

export class ResetCredentialDto {
  @ApiProperty({ description: 'ID of the user to reset' })
  userId: string;

  @ApiProperty({ description: 'New password or pin code' })
  newCredential: string;

  @ApiProperty({ enum: ['PASSWORD', 'PIN'] })
  type: 'PASSWORD' | 'PIN';
}

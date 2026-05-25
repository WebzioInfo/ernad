import { BadRequestException } from '@nestjs/common';

export class NonRetryableBusinessError extends BadRequestException {
  constructor(message: string, public readonly errorCode?: string) {
    super(message);
    this.name = 'NonRetryableBusinessError';
  }
}

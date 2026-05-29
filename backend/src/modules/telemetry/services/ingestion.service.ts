import { Injectable, Logger } from '@nestjs/common';
import { NonRetryableBusinessError } from '../../../common/errors/non-retryable-business.error';
import { TelemetryDto } from '../dto/telemetry.dto';
import { RedisService } from '../../../providers/redis/redis.service';
import { ProcessingService } from './processing.service';
import { TerminalService } from '../../production/services/terminal.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly processingService: ProcessingService,
    private readonly terminalService: TerminalService,
  ) {}

  async createLog(authenticatedUserId: string, dto: TelemetryDto) {
    if (!dto.batchId || !dto.station) {
      throw new NonRetryableBusinessError('Invalid telemetry payload. Batch ID and Station are required.');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dto.batchId)) {
      throw new NonRetryableBusinessError('Invalid Batch ID format. Must be a valid UUID.');
    }
    if (dto.productId && !uuidRegex.test(dto.productId)) {
      throw new NonRetryableBusinessError('Invalid Product ID format.');
    }
    if (dto.brandId && !uuidRegex.test(dto.brandId)) {
      throw new NonRetryableBusinessError('Invalid Brand ID format.');
    }
    if (dto.lineId && !uuidRegex.test(dto.lineId)) {
      throw new NonRetryableBusinessError('Invalid Line ID format.');
    }
    if (dto.shiftId && !uuidRegex.test(dto.shiftId)) {
      throw new NonRetryableBusinessError('Invalid Shift ID format.');
    }

    const dedupeKey = `telemetry:fingerprint:${dto.requestId}`;
    if (this.redisService.getAvailability() && dto.requestId) {
      const isDuplicate = await this.redisService.get(dedupeKey);
      if (isDuplicate) {
        throw new NonRetryableBusinessError(`Duplicate request fingerprint detected: ${dto.requestId}`);
      }
      await this.redisService.set(dedupeKey, 'active', 'EX', 600);
    }

    let finalUserId = authenticatedUserId;

    if (dto.operatorId && dto.operatorPin) {
      const operator = await this.terminalService.verifyOperatorForAction(dto.operatorId, dto.operatorPin);
      finalUserId = operator.id;
      this.logger.debug(`[HYBRID] Action attributed to Operator: ${operator.name} via Terminal: ${dto.terminalId}`);
    }

    await this.processingService.preValidateTelemetry(finalUserId, dto);

    // Commit directly so the operator history has read-after-write consistency.
    const log = await this.processingService.handleTelemetryLog(finalUserId, dto);

    return {
      status: 'COMMITTED',
      requestId: dto.requestId,
      log,
      message: 'Log committed to ledger.'
    };
  }

  async getLogHistory(batchId: string, station: string, operatorView = false) {
    return this.processingService.getLogHistory(batchId, station, 50, operatorView);
  }
}

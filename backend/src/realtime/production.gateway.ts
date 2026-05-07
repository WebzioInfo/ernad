import { Injectable, Logger } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@Injectable()
export class ProductionEventsService {
  private readonly logger = new Logger(ProductionEventsService.name);

  constructor(private realtimeService: RealtimeService) {}

  /**
   * Dispatches real-time telemetry via Pusher.
   * Socket.io fallback removed to ensure serverless stability on Vercel.
   */
  async emitNewLog(log: any) {
    this.logger.debug(`Emitting telemetry for line_${log.lineId} via Pusher`);
    
    await this.realtimeService.emit(`line_${log.lineId}`, 'new_log', {
      lineId: log.lineId,
      station: log.station,
      count: log.primaryCount,
      timestamp: log.loggedAt
    });
    
    await this.realtimeService.emit('managers', 'global_log_update', { lineId: log.lineId });
  }

  async emitLineStatus(lineId: string, status: string) {
    this.logger.log(`Line ${lineId} status updated: ${status}`);
    await this.realtimeService.emit(`line_${lineId}`, 'line_status', { lineId, status });
    await this.realtimeService.emit('managers', 'line_status', { lineId, status });
  }

  async emitEfficiencyAlert(lineId: string, efficiency: number) {
    await this.realtimeService.emit(`line_${lineId}`, 'efficiency_alert', { 
      lineId, 
      efficiency,
      message: `Efficiency dropped to ${efficiency}%`
    });
  }

  async emitProductionUpdated(batchId: string, lineId: string) {
    await this.realtimeService.emit(`line_${lineId}`, 'PRODUCTION_UPDATED', { batchId, lineId });
    await this.realtimeService.emit('managers', 'PRODUCTION_UPDATED', { batchId, lineId });
  }

  async emitNotification(notification: any) {
    await this.realtimeService.emit('managers', 'NEW_NOTIFICATION', notification);
    await this.realtimeService.emit('operators', 'NEW_NOTIFICATION', notification);
  }
}

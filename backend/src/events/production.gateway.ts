import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'production',
  cors: {
    origin: '*',
  },
})
export class ProductionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProductionGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_line')
  handleJoinLine(@MessageBody() lineId: string, @ConnectedSocket() client: Socket) {
    client.join(`line_${lineId}`);
    this.logger.log(`Client ${client.id} joined line_${lineId}`);
    return { status: 'joined', room: `line_${lineId}` };
  }

  @SubscribeMessage('leave_line')
  handleLeaveLine(@MessageBody() lineId: string, @ConnectedSocket() client: Socket) {
    client.leave(`line_${lineId}`);
    this.logger.log(`Client ${client.id} left line_${lineId}`);
  }

  // Phase 7: Real-Time Events (Targeted to Rooms)
  emitNewLog(log: any) {
    this.server.to(`line_${log.lineId}`).emit('new_log', {
      lineId: log.lineId,
      station: log.station,
      count: log.primaryCount,
      timestamp: log.loggedAt
    });
    
    // Also notify global managers
    this.server.to('managers').emit('global_log_update', { lineId: log.lineId });
  }

  @SubscribeMessage('join_managers')
  handleJoinManagers(@ConnectedSocket() client: Socket) {
    client.join('managers');
    this.logger.log(`Manager ${client.id} joined manager room`);
  }

  emitLineStatus(lineId: string, status: string) {
    this.server.to(`line_${lineId}`).to('managers').emit('line_status', { lineId, status });
  }

  emitEfficiencyAlert(lineId: string, efficiency: number) {
    this.server.to(`line_${lineId}`).to('managers').emit('efficiency_alert', { 
      lineId, 
      efficiency, 
      message: `Efficiency dropped to ${efficiency}%` 
    });
  }

  emitProductionUpdated(batchId: string, lineId: string) {
    this.server.to(`line_${lineId}`).to('managers').emit('PRODUCTION_UPDATED', {
      timestamp: new Date(),
      batchId,
    });
  }
}


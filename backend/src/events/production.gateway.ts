import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
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

  // Emits an event to all connected clients that the production data (logs/stats) has updated
  emitProductionUpdated(batchId?: string) {
    this.server.emit('PRODUCTION_UPDATED', {
      timestamp: new Date(),
      batchId,
    });
    this.logger.log('Broadcasted PRODUCTION_UPDATED event');
  }
}

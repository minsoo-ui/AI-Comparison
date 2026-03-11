import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class QuoteGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuoteGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Send a log message to all connected clients.
   * @param level 'info' | 'warn' | 'error' | 'success'
   * @param stage 'OCR' | 'CLEAN' | 'LLM' | 'SYSTEM'
   * @param message
   */
  emitLog(level: string, stage: string, message: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
    };
    this.server.emit('quote_log', logEntry);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    return { event: 'pong', data };
  }
}

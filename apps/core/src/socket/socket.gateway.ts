import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JoinConversationPayload, LeaveConversationPayload, MessageSocket, SendMessagePayload, TypingPayload } from 'libs/utils/enum';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // JOIN / LEAVE CONVERSATION ROOM

  @SubscribeMessage('chat:join-conversation')
  handleJoinConversation(client: Socket, payload: JoinConversationPayload) {
    const room = `conversation_${payload.conversationId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);

    // Confirm cho client biết đã join
    client.emit('chat:joined-conversation', {
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('chat:leave-conversation')
  handleLeaveConversation(client: Socket, payload: LeaveConversationPayload) {
    const room = `conversation_${payload.conversationId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);

    client.emit('chat:leave-conversation', {
      conversationId: payload.conversationId,
    });
  }

  // SEND MESSAGE

  @SubscribeMessage('chat:send-message')
  handleSendMessage(client: Socket, payload: SendMessagePayload) {
    const room = `conversation_${payload.conversationId}`;

    // Map về structure giống model Message
    const message: MessageSocket = {
      message_id: null, // FE dùng tempId cho tới khi nhận được id thật từ REST / event khác
      conversation_id: payload.conversationId,
      senderId: payload.senderId,
      content: payload.content,
      createdAt: new Date().toISOString(),
    };

    this.logger.log(
      `[ChatGateway] New message in conversation ${payload.conversationId} from sender ${payload.senderId}`,
    );

    // Broadcast cho tất cả client trong conversation
    this.server.to(room).emit('chat:new-message', {
      message,
      tempId: payload.tempId ?? null,
    });

    // Echo lại riêng cho client gửi (để confirm)
    client.emit('chat:sent', {
      conversationId: payload.conversationId,
      tempId: payload.tempId ?? null,
    });
  }

  // TYPING INDICATOR

  @SubscribeMessage('chat:typing')
  handleTyping(client: Socket, payload: TypingPayload) {
    const room = `conversation_${payload.conversationId}`;

    this.server.to(room).emit('chat:typing', {
      conversationId: payload.conversationId,
      userId: payload.userId,
    });
  }

  @SubscribeMessage('chat:stop-typing')
  handleStopTyping(client: Socket, payload: TypingPayload) {
    const room = `conversation_${payload.conversationId}`;

    this.server.to(room).emit('chat:stop-typing', {
      conversationId: payload.conversationId,
      userId: payload.userId,
    });
  }

  // Method để broadcast message
  broadcastNewMessage(message: any) {
    this.logger.log(`Broadcasting message: ${message.message_id}`);
    const room = `conversation_${message.conversation_id}`;
    this.server.to(room).emit('chat:new-message', { message, tempId: null });
  }
}

import { Global, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Global()
@Module({
  imports: [],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule { }

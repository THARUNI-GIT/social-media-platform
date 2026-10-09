import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
const origins = () => (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
/** Same handshake auth as chat-service. Path is namespaced so the gateway can route it separately. */
@WebSocketGateway({ path: '/notifications/socket.io', cors: { origin: (o: string, cb: any) => cb(null, !o || origins().includes(o)), credentials: true } })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;
  afterInit(server: Server) {
    server.use((socket, next) => {
      try {
        const p: any = jwt.verify(socket.handshake.auth?.token, (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'), { algorithms: ['RS256', 'ES256'] });
        const uid = p.sub ?? p.userId ?? p.id; if (!uid) return next(new Error('UNAUTHORIZED'));
        socket.data.userId = String(uid); next();
      } catch { next(new Error('UNAUTHORIZED')); }
    });
  }
  async handleConnection(c: Socket) { await c.join(`user:${c.data.userId}`); }
  toUser(userId: string, event: string, data: unknown) { this.server?.to(`user:${userId}`).emit(event, data); }
}

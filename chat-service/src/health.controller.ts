import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private connection: Connection) {}

  @Get()
  async health() {
    const ready = this.connection.readyState === 1;
    return {
      status: ready ? 'ok' : 'degraded',
      service: 'chat-service',
      mongo: this.connection.readyState,
    };
  }
}

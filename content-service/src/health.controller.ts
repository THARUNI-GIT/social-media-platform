import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private db: PrismaService) {}

  @Get()
  async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'content-service' };
    } catch (e: any) {
      return { status: 'error', service: 'content-service', error: e.message };
    }
  }
}

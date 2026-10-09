import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export const PRESENCE_CHANNEL = 'presence-events';

@Injectable()
export class PresenceService {
  private inMemoryPresence = new Map<string, { lastSeenAt: string }>();

  constructor(private redis: RedisService) {}

  async heartbeat(userId: string): Promise<void> {
    const now = new Date().toISOString();
    this.inMemoryPresence.set(userId, { lastSeenAt: now });
  }

  async clear(userId: string): Promise<void> {
    this.inMemoryPresence.delete(userId);
  }

  async lastSeen(userId: string): Promise<string> {
    const p = this.inMemoryPresence.get(userId);
    return p?.lastSeenAt ?? new Date().toISOString();
  }

  async publish(data: { userId: string; status: 'online' | 'offline'; lastSeenAt: string; conversationIds: string[] }): Promise<void> {
    await this.redis.publish(PRESENCE_CHANNEL, JSON.stringify(data));
  }

  async setTyping(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    // Typing indicator handled directly or stored in Redis
  }
}

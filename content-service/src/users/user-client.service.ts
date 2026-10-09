import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface UserSummary {
  id: string;
  username: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  verified?: boolean;
}

@Injectable()
export class UserClient {
  private log = new Logger('UserClient');
  private baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3003';

  static author(map: Map<string, UserSummary>, id: string): UserSummary {
    const u = map.get(id);
    if (u) return u;
    return { id, username: id, handle: id, displayName: id, avatarUrl: undefined, verified: false };
  }

  async batch(ids: string[]): Promise<Map<string, UserSummary>> {
    const map = new Map<string, UserSummary>();
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return map;

    try {
      const res = await axios.post(`${this.baseUrl}/users/batch`, { ids: uniqueIds }, { timeout: 3000 });
      const raw = res.data;
      const list: UserSummary[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      for (const u of list) {
        if (u && u.id) {
          map.set(u.id, u);
        }
      }
    } catch (err: any) {
      this.log.warn(`batch user lookup failed: ${err.message}`);
    }
    return map;
  }
}

import { env } from '../config/env.js';
import { redis } from '../redis/redisClient.js';

interface RedisLike {
  hset(key: string, field: string, value: string): Promise<unknown>;
  rpush(key: string, value: string): Promise<unknown>;
  lrem(key: string, count: number, value: string): Promise<unknown>;
  hdel(key: string, ...fields: string[]): Promise<unknown>;
  lpop(key: string): Promise<string | null>;
  lpush(key: string, value: string): Promise<unknown>;
  hmget(key: string, ...fields: string[]): Promise<Array<string | null>>;
}

export interface QueueEntry {
  userId: string;
  username: string;
  gameMode: string;
  joinedAt: number;
}

export class MatchmakingService {
  private readonly queueKey = env.MATCHMAKING_QUEUE_KEY;

  constructor(private readonly redisClient: RedisLike = redis) {}

  async joinQueue(entry: QueueEntry): Promise<void> {
    await this.redisClient.hset(`${this.queueKey}:meta`, entry.userId, JSON.stringify(entry));
    await this.redisClient.rpush(this.queueKey, entry.userId);
  }

  async leaveQueue(userId: string): Promise<void> {
    await this.redisClient.lrem(this.queueKey, 0, userId);
    await this.redisClient.hdel(`${this.queueKey}:meta`, userId);
  }

  async popMatchPair(): Promise<[QueueEntry, QueueEntry] | null> {
    const firstId = await this.redisClient.lpop(this.queueKey);
    if (!firstId) {
      return null;
    }
    const secondId = await this.redisClient.lpop(this.queueKey);
    if (!secondId) {
      await this.redisClient.lpush(this.queueKey, firstId);
      return null;
    }

    const [firstRaw, secondRaw] = await this.redisClient.hmget(`${this.queueKey}:meta`, firstId, secondId);
    await this.redisClient.hdel(`${this.queueKey}:meta`, firstId, secondId);

    if (!firstRaw || !secondRaw) {
      return null;
    }

    return [JSON.parse(firstRaw) as QueueEntry, JSON.parse(secondRaw) as QueueEntry];
  }
}

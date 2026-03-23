import { env } from '../config/env.js';
import { redis } from '../redis/redisClient.js';

interface RedisLike {
  hset(key: string, field: string, value: string): Promise<unknown>;
  rpush(key: string, value: string): Promise<unknown>;
  lrem(key: string, count: number, value: string): Promise<unknown>;
  hdel(key: string, ...fields: string[]): Promise<unknown>;
  hmget(key: string, ...fields: string[]): Promise<Array<string | null>>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

export interface QueueEntry {
  userId: string;
  username: string;
  tpcAccountNumber?: string;
  gameMode: string;
  region?: string;
  joinedAt: number;
}

export class MatchmakingService {
  private readonly queueKey = env.MATCHMAKING_QUEUE_KEY;

  constructor(private readonly redisClient: RedisLike = redis) {}

  async joinQueue(entry: QueueEntry): Promise<void> {
    await this.redisClient.lrem(this.queueKey, 0, entry.userId);
    await this.redisClient.hset(`${this.queueKey}:meta`, entry.userId, JSON.stringify(entry));
    await this.redisClient.rpush(this.queueKey, entry.userId);
  }

  async leaveQueue(userId: string): Promise<void> {
    await this.redisClient.lrem(this.queueKey, 0, userId);
    await this.redisClient.hdel(`${this.queueKey}:meta`, userId);
  }

  async popMatchPair(requesterId?: string): Promise<[QueueEntry, QueueEntry] | null> {
    const allQueuedIds = await this.redisClient.lrange(this.queueKey, 0, -1);
    if (allQueuedIds.length < 2) {
      return null;
    }

    const [requester, opponent] = requesterId
      ? await this.pickCompatibleWithRequester(requesterId, allQueuedIds)
      : await this.pickFirstCompatiblePair(allQueuedIds);

    if (!requester || !opponent) {
      return null;
    }

    await this.redisClient.lrem(this.queueKey, 0, requester.userId);
    await this.redisClient.lrem(this.queueKey, 0, opponent.userId);
    await this.redisClient.hdel(`${this.queueKey}:meta`, requester.userId, opponent.userId);

    return [requester, opponent];
  }

  private async pickCompatibleWithRequester(
    requesterId: string,
    queuedIds: string[],
  ): Promise<[QueueEntry | null, QueueEntry | null]> {
    const requesterRaw = (await this.redisClient.hmget(`${this.queueKey}:meta`, requesterId))[0];
    if (!requesterRaw) {
      return [null, null];
    }
    const requester = JSON.parse(requesterRaw) as QueueEntry;

    const opponentIds = queuedIds.filter((queuedId) => queuedId !== requesterId);
    if (opponentIds.length === 0) {
      return [null, null];
    }

    const opponentsRaw = await this.redisClient.hmget(`${this.queueKey}:meta`, ...opponentIds);
    for (let i = 0; i < opponentsRaw.length; i += 1) {
      const raw = opponentsRaw[i];
      if (!raw) {
        continue;
      }
      const candidate = JSON.parse(raw) as QueueEntry;
      if (this.canMatchTogether(requester, candidate)) {
        return [requester, candidate];
      }
    }

    return [null, null];
  }

  private async pickFirstCompatiblePair(queuedIds: string[]): Promise<[QueueEntry | null, QueueEntry | null]> {
    const entriesRaw = await this.redisClient.hmget(`${this.queueKey}:meta`, ...queuedIds);
    const entries = entriesRaw
      .map((raw) => (raw ? (JSON.parse(raw) as QueueEntry) : null))
      .filter((entry): entry is QueueEntry => Boolean(entry));

    for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
        const first = entries[firstIndex];
        const second = entries[secondIndex];
        if (this.canMatchTogether(first, second)) {
          return [first, second];
        }
      }
    }

    return [null, null];
  }

  private canMatchTogether(first: QueueEntry, second: QueueEntry): boolean {
    if (first.userId === second.userId) {
      return false;
    }

    const firstRegion = first.region?.toLowerCase() ?? 'global';
    const secondRegion = second.region?.toLowerCase() ?? 'global';

    return first.gameMode === second.gameMode && firstRegion === secondRegion;
  }
}

import { describe, expect, it } from 'vitest';
import { MatchmakingService, type QueueEntry } from '../src/services/matchmakingService.js';

class InMemoryRedis {
  private lists = new Map<string, string[]>();
  private hashes = new Map<string, Map<string, string>>();

  async hset(key: string, field: string, value: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(field, value);
    this.hashes.set(key, hash);
    return 1;
  }

  async rpush(key: string, value: string) {
    const list = this.lists.get(key) ?? [];
    list.push(value);
    this.lists.set(key, list);
    return list.length;
  }

  async lrem(key: string, _count: number, value: string) {
    const list = this.lists.get(key) ?? [];
    this.lists.set(
      key,
      list.filter((item) => item !== value),
    );
    return 1;
  }

  async hdel(key: string, ...fields: string[]) {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    fields.forEach((field) => hash.delete(field));
    return 1;
  }

  async lpop(key: string) {
    const list = this.lists.get(key) ?? [];
    const item = list.shift() ?? null;
    this.lists.set(key, list);
    return item;
  }

  async lpush(key: string, value: string) {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
    return list.length;
  }

  async hmget(key: string, ...fields: string[]) {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    return fields.map((field) => hash.get(field) ?? null);
  }
}

const makeEntry = (userId: string): QueueEntry => ({
  userId,
  username: `player-${userId}`,
  gameMode: 'ranked',
  joinedAt: Date.now(),
});

describe('MatchmakingService', () => {
  it('pairs two queued players', async () => {
    const redis = new InMemoryRedis();
    const service = new MatchmakingService(redis);

    await service.joinQueue(makeEntry('u1'));
    await service.joinQueue(makeEntry('u2'));

    const pair = await service.popMatchPair();
    expect(pair).not.toBeNull();
    expect(pair?.[0].userId).toBe('u1');
    expect(pair?.[1].userId).toBe('u2');
  });

  it('returns null when queue has less than two players', async () => {
    const redis = new InMemoryRedis();
    const service = new MatchmakingService(redis);

    await service.joinQueue(makeEntry('solo'));
    const pair = await service.popMatchPair();

    expect(pair).toBeNull();
  });
});

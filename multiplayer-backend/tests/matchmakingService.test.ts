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

  async hmget(key: string, ...fields: string[]) {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    return fields.map((field) => hash.get(field) ?? null);
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.lists.get(key) ?? [];
    const safeStop = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, safeStop);
  }
}

const makeEntry = (userId: string, overrides: Partial<QueueEntry> = {}): QueueEntry => ({
  userId,
  username: `player-${userId}`,
  gameMode: 'ranked',
  region: 'eu',
  joinedAt: Date.now(),
  ...overrides,
});

describe('MatchmakingService', () => {
  it('pairs requester with compatible queued player', async () => {
    const redis = new InMemoryRedis();
    const service = new MatchmakingService(redis);

    await service.joinQueue(makeEntry('u1'));
    await service.joinQueue(makeEntry('u2'));

    const pair = await service.popMatchPair('u2');
    expect(pair).not.toBeNull();
    expect(pair?.[0].userId).toBe('u2');
    expect(pair?.[1].userId).toBe('u1');
  });

  it('does not pair players from different game modes or regions', async () => {
    const redis = new InMemoryRedis();
    const service = new MatchmakingService(redis);

    await service.joinQueue(makeEntry('u1', { gameMode: 'ranked', region: 'eu' }));
    await service.joinQueue(makeEntry('u2', { gameMode: 'casual', region: 'eu' }));
    await service.joinQueue(makeEntry('u3', { gameMode: 'ranked', region: 'na' }));

    const pair = await service.popMatchPair('u1');
    expect(pair).toBeNull();
  });

  it('deduplicates queue joins for the same user', async () => {
    const redis = new InMemoryRedis();
    const service = new MatchmakingService(redis);

    await service.joinQueue(makeEntry('u1'));
    await service.joinQueue(makeEntry('u1'));
    await service.joinQueue(makeEntry('u2'));

    const pair = await service.popMatchPair('u2');
    expect(pair).not.toBeNull();
    expect(pair?.[0].userId).toBe('u2');
    expect(pair?.[1].userId).toBe('u1');

    const secondTry = await service.popMatchPair('u1');
    expect(secondTry).toBeNull();
  });
});

import { env } from '../config/env.js';
import { redis } from '../redis/redisClient.js';
export class MatchmakingService {
    redisClient;
    queueKey = env.MATCHMAKING_QUEUE_KEY;
    constructor(redisClient = redis) {
        this.redisClient = redisClient;
    }
    async joinQueue(entry) {
        await this.redisClient.hset(`${this.queueKey}:meta`, entry.userId, JSON.stringify(entry));
        await this.redisClient.rpush(this.queueKey, entry.userId);
    }
    async leaveQueue(userId) {
        await this.redisClient.lrem(this.queueKey, 0, userId);
        await this.redisClient.hdel(`${this.queueKey}:meta`, userId);
    }
    async popMatchPair() {
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
        return [JSON.parse(firstRaw), JSON.parse(secondRaw)];
    }
}

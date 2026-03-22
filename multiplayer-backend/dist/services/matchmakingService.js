import { env } from '../config/env.js';
import { redis } from '../redis/redisClient.js';
export class MatchmakingService {
    redisClient;
    queueKey = env.MATCHMAKING_QUEUE_KEY;
    constructor(redisClient = redis) {
        this.redisClient = redisClient;
    }
    async joinQueue(entry) {
        await this.redisClient.lrem(this.queueKey, 0, entry.userId);
        await this.redisClient.hset(`${this.queueKey}:meta`, entry.userId, JSON.stringify(entry));
        await this.redisClient.rpush(this.queueKey, entry.userId);
    }
    async leaveQueue(userId) {
        await this.redisClient.lrem(this.queueKey, 0, userId);
        await this.redisClient.hdel(`${this.queueKey}:meta`, userId);
    }
    async popMatchPair(requesterId) {
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
    async pickCompatibleWithRequester(requesterId, queuedIds) {
        const requesterRaw = (await this.redisClient.hmget(`${this.queueKey}:meta`, requesterId))[0];
        if (!requesterRaw) {
            return [null, null];
        }
        const requester = JSON.parse(requesterRaw);
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
            const candidate = JSON.parse(raw);
            if (this.canMatchTogether(requester, candidate)) {
                return [requester, candidate];
            }
        }
        return [null, null];
    }
    async pickFirstCompatiblePair(queuedIds) {
        const entriesRaw = await this.redisClient.hmget(`${this.queueKey}:meta`, ...queuedIds);
        const entries = entriesRaw
            .map((raw) => (raw ? JSON.parse(raw) : null))
            .filter((entry) => Boolean(entry));
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
    canMatchTogether(first, second) {
        if (first.userId === second.userId) {
            return false;
        }
        const firstRegion = first.region?.toLowerCase() ?? 'global';
        const secondRegion = second.region?.toLowerCase() ?? 'global';
        return first.gameMode === second.gameMode && firstRegion === secondRegion;
    }
}

import { createExploreRooms } from './exploreRooms.mjs';
import { exploreSimulation } from '../../webapp/src/games/tirana-social/exploreSimulation.mjs';
import User from '../models/User.js';
import { findMemoryUser, shouldUseMemoryUserStore } from '../utils/memoryUserStore.js';

// Racing Royal's shared city rooms remain available independently of retired games.
export function createRacingExplore(options = {}) {
  return createExploreRooms({
    engine: exploreSimulation,
    now: options.now,
    autoTick: options.autoTick,
    resolveProfile: async (accountId) =>
      shouldUseMemoryUserStore()
        ? findMemoryUser({ accountId })
        : User.findOne({ accountId })
            .select('accountId telegramId nickname firstName photo isBanned')
            .lean()
  });
}

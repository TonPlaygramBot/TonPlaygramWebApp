import { createKartStakeService } from './kartStake.js';
import BowlingMatch from '../models/BowlingMatch.js';
export const createBowlingStakeService = (options = {}) =>
  createKartStakeService({
    ...options,
    MatchModel: options.MatchModel || BowlingMatch,
    gameType: 'royallanes',
    ledgerPrefix: 'bowling',
    maxPlayers: 2,
    reservationTtlMs: 45 * 60_000
  });

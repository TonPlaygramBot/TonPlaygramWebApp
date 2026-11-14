import { createKartStakeService } from './kartStake.js';
import BlackwaterMatch from '../models/BlackwaterMatch.js';

// Retained only to refund persisted stakes from the retired game.
// No new Blackwater tables or game runtime are registered.
export const createBlackwaterStakeService = (options = {}) =>
  createKartStakeService({
    ...options,
    MatchModel: options.MatchModel || BlackwaterMatch,
    gameType: 'blackwater',
    ledgerPrefix: 'blackwater',
    maxPlayers: 4
  });

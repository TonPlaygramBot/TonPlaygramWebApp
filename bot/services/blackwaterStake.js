import { createKartStakeService } from './kartStake.js';
import BlackwaterMatch from '../models/BlackwaterMatch.js';

// Same transactional reservation/refund/payout implementation as Racing Royal.
export const createBlackwaterStakeService = (options = {}) =>
  createKartStakeService({
    ...options,
    MatchModel: options.MatchModel || BlackwaterMatch,
    gameType: 'blackwater',
    ledgerPrefix: 'blackwater',
    maxPlayers: 4
  });

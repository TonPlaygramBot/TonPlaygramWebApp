import { createKartStakeService } from './kartStake.js';
import { tabletopMatchModels } from '../models/TabletopMatch.js';
export const createTabletopStakeServices = () =>
  Object.fromEntries(
    Object.entries(tabletopMatchModels).map(([gameType, MatchModel]) => [
      gameType,
      createKartStakeService({
        MatchModel,
        gameType,
        ledgerPrefix: gameType,
        maxPlayers: 4,
        reservationTtlMs: 35 * 60_000
      })
    ])
  );

// Persisted reservations also protect account locks after a process restart.
export async function activeTabletopReservationIds(
  account,
  models = tabletopMatchModels
) {
  const records = await Promise.all(
    Object.values(models).map((Model) =>
      Model.find({ accounts: String(account), status: 'playing' })
        .select('tableId')
        .lean()
    )
  );
  return records.flat().map((match) => match.tableId);
}

import {createTiranaStreets as createLegacyTiranaStreets} from './legacyTiranaStreets.js';
import {createExploreRooms} from './exploreRooms.mjs';
import {exploreSimulation} from '../../webapp/src/games/tirana-social/exploreSimulation.mjs';
import User from '../models/User.js';
import {findMemoryUser,shouldUseMemoryUserStore} from '../utils/memoryUserStore.js';
/** Preserve all existing room/career/payment behavior. Both games enter the same
 * new free Explore authority via the existing server's service.attach call. */
export function createTiranaStreets(options={}) {
  const legacy=createLegacyTiranaStreets(options);
  const explore=createExploreRooms({engine:exploreSimulation,now:options.now,autoTick:options.autoTick,
    resolveProfile:async accountId=>shouldUseMemoryUserStore()?findMemoryUser({accountId}):User.findOne({accountId}).select('accountId telegramId nickname firstName photo isBanned').lean()});
  return {...legacy,explore,attach(socket){legacy.attach(socket);explore.attach(socket);},close(){explore.close();legacy.close();}};
}

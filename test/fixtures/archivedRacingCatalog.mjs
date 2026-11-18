// Historical geometry remains a regression fixture, never a selectable runtime route.
import * as legacy from '../../webapp/src/games/kartroyale/legacySimulation.mjs';
import {TIRANA_ROUTES} from '../../webapp/src/games/kartroyale/tirana-routes.mjs';
import {MAIN_ROAD_ROUTES} from '../../webapp/src/games/kartroyale/main-road-routes.mjs';
import {buildRaceCatalog} from '../../webapp/src/games/kartroyale/raceCatalog.mjs';
const catalog=buildRaceCatalog(legacy,TIRANA_ROUTES,MAIN_ROAD_ROUTES);
export const makeArchivedTrack=catalog.makeTrack;
export const ARCHIVED_TRACKS=catalog.tracks;

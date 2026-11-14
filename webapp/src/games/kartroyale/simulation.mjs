// Browser and server share fixed-step physics and the five updated Tirana IDs.
// Long city routes are authored offline; no graph searches during module import.
export * from './legacySimulation.mjs';
import * as legacy from './legacySimulation.mjs';
import {TIRANA_ROUTES} from './tirana-routes.mjs';
import {MAIN_ROAD_ROUTES} from './main-road-routes.mjs';
import {RURAL_ROUTES} from './rural-routes.mjs';
import {buildRaceCatalog} from './raceCatalog.mjs';
const catalog=buildRaceCatalog(legacy,TIRANA_ROUTES,MAIN_ROAD_ROUTES,RURAL_ROUTES);
export const TRACKS=catalog.tracks;
export const CUPS=catalog.cups;
export const GRAND_ROUTE_DIAGNOSTICS=catalog.diagnostics;
export const makeTrack=catalog.makeTrack;

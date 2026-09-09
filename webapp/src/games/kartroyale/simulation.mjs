// Browser and server retain the original fixed-step kart physics and original
// five Tirana circuit IDs. No whole-city path searches during module import.
export * from './legacySimulation.mjs';
import * as legacy from './legacySimulation.mjs';
import {TIRANA_ROUTES} from './tirana-routes.mjs';
import {buildRaceCatalog} from './raceCatalog.mjs';
const catalog=buildRaceCatalog(legacy,TIRANA_ROUTES);
export const TRACKS=catalog.tracks;
export const CUPS=catalog.cups;
export const GRAND_ROUTE_DIAGNOSTICS=catalog.diagnostics;
export const makeTrack=catalog.makeTrack;

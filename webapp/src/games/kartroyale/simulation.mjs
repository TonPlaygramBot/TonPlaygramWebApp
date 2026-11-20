// Browser and server share fixed-step physics and the city circuit catalogue.
// Long city routes are authored offline; no graph searches during module import.
export * from './legacySimulation.mjs';
import * as legacy from './legacySimulation.mjs';
import {URBAN_RACE_ROUTES} from './urban-race-routes.mjs';
import {buildRaceCatalog} from './raceCatalog.mjs';
import {normalizeTrack,TRACK_ALIASES} from './trackMigration.mjs';
export {normalizeTrack,TRACK_ALIASES};
const catalog=buildRaceCatalog({...legacy,TRACKS:[],CUPS:legacy.CUPS.map(c=>({...c,track:normalizeTrack(c.track)})),normalizeTrack},[],[],URBAN_RACE_ROUTES);
export const TRACKS=catalog.tracks;
export const CUPS=catalog.cups;
export const GRAND_ROUTE_DIAGNOSTICS=catalog.diagnostics;
export const makeTrack=catalog.makeTrack;

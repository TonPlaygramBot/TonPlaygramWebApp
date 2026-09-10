import { WORLD } from '../tiranastreets/shared/world.mjs';
import { CITY_SOURCE } from './sourceData.mjs';
import { resolvePlaces, mappedCycling, mappedTrees } from './sourceCore.mjs';
// These identities have dated photo records as well as source building tags.
// OSM's bank/building tags alone do not describe the civic use of these sites.
import { REFERENCE_BUILDINGS } from './profiles.mjs';
const basePlaces = resolvePlaces(WORLD, CITY_SOURCE);
const referencePlaces = Object.entries(REFERENCE_BUILDINGS).flatMap(([id, profile]) => {
  if (basePlaces.sites.some(p => p.buildingId === id)) return [];
  const building = CITY_SOURCE.buildings.find(b => b.id === `way/${id}`);
  if (!building) return [];
  const category = ['hotel', 'rogner'].includes(profile.style) ? 'hotel'
    : profile.style === 'taivani' ? 'casino' : 'government';
  return [{...building, category}];
});
export const CITY_PLACES = resolvePlaces(WORLD, {...CITY_SOURCE, places: [...CITY_SOURCE.places, ...referencePlaces]});
// An Albanian flag is also visible in the University's recorded photo reference.
CITY_PLACES.sites = CITY_PLACES.sites.map(site => ({...site,
  country: site.country ?? REFERENCE_BUILDINGS[site.buildingId]?.flagCountry ?? null}));
export const INSTITUTION_BUILDING_IDS = new Set(CITY_PLACES.sites.map(p=>p.buildingId));
export const MAPPED_CYCLING = mappedCycling(WORLD,CITY_SOURCE);
export const MAPPED_TREES = mappedTrees(WORLD,CITY_SOURCE);
export const BUILDING_SOURCE_TAGS = new Map(CITY_SOURCE.buildings.map(b=>[b.id.slice(4),b.tags]));
export const BUILDING_SITE = new Map(CITY_PLACES.sites.map(p=>[p.buildingId,p]));

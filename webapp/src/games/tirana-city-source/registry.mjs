import { WORLD } from '../tiranastreets/shared/world.mjs';
import { CITY_SOURCE } from './sourceData.mjs';
import { resolvePlaces, mappedCycling, mappedTrees } from './sourceCore.mjs';
// These identities have dated photo records as well as source building tags.
// OSM's bank/building tags alone do not describe the civic use of these sites.
import { REFERENCE_BUILDINGS } from './profiles.mjs';
import { landmarkBuildings, LANDMARK_REPLACED_IDS } from './landmarkCatalog.mjs';
import { CITY_BUILDING_DATA } from './cityBuildingData.mjs';
import {EDUCATION_SITES} from './educationSites.mjs';
const basePlaces = resolvePlaces(WORLD, CITY_SOURCE);
const referencePlaces = Object.entries(REFERENCE_BUILDINGS).flatMap(([id, profile]) => {
  // Private malls and residences must never inherit the government's AL flag.
  if (profile.category && !['government','hotel','casino','university'].includes(profile.category)) return [];
  if (basePlaces.sites.some(p => p.buildingId === id)) return [];
  const building = CITY_SOURCE.buildings.find(b => b.id === `way/${id}`);
  if (!building) return [];
  const category = profile.category ?? (['hotel', 'rogner'].includes(profile.style) ? 'hotel'
    : profile.style === 'taivani' ? 'casino' : 'government');
  return [{...building, category}];
});
export const CITY_PLACES = resolvePlaces(WORLD, {...CITY_SOURCE, places: [...CITY_SOURCE.places, ...referencePlaces]});
for(const site of EDUCATION_SITES)if(!CITY_PLACES.sites.some(s=>s.buildingId===site.buildingId&&s.category===site.category))CITY_PLACES.sites.push(site);
// An Albanian flag is also visible in the University's recorded photo reference.
CITY_PLACES.sites = CITY_PLACES.sites.map(site => ({...site,
  country: site.country ?? REFERENCE_BUILDINGS[site.buildingId]?.flagCountry ?? null}));
// Regional catalog buildings use their own mapped outlines. They must not be
// snapped onto a nearby in-map building or silently lose their public flag.
for (const b of landmarkBuildings(WORLD)) {
  const profile=REFERENCE_BUILDINGS[b.id];
  if (!profile?.flagCountry || !CITY_BUILDING_DATA.buildings.some(x=>x.id===b.id)
      || CITY_PLACES.sites.some(s=>s.buildingId===b.id)) continue;
  CITY_PLACES.sites.push({id:`catalog/${b.id}`,sourceId:`way/${b.id}`,buildingId:b.id,
    name:profile.name,category:profile.category,country:profile.flagCountry,
    footprint:b.p,x:b.p.reduce((s,v)=>s+v[0],0)/b.p.length,z:b.p.reduce((s,v)=>s+v[1],0)/b.p.length,
    height:profile.height??b.h,tags:b.tags??{},match:'mapped catalog footprint',source:profile.source,
    website:null,placementAccuracy:'Mapped outline; pole location estimated',anchor:null});
}
export const INSTITUTION_BUILDING_IDS = new Set([...CITY_PLACES.sites.map(p=>p.buildingId),...Object.keys(REFERENCE_BUILDINGS),...LANDMARK_REPLACED_IDS]);
export const MAPPED_CYCLING = mappedCycling(WORLD,CITY_SOURCE);
export const MAPPED_TREES = mappedTrees(WORLD,CITY_SOURCE);
export const BUILDING_SOURCE_TAGS = new Map(CITY_SOURCE.buildings.map(b=>[b.id.slice(4),b.tags]));
export const BUILDING_SITE = new Map(CITY_PLACES.sites.map(p=>[p.buildingId,p]));

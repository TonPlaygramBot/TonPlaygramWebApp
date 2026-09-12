import { WORLD } from '../tiranastreets/shared/world.mjs';
import { CITY_SOURCE } from './sourceData.mjs';
import { REFERENCE_BUILDINGS } from './profiles.mjs';
import { housingEra,rooftopTanks } from './housingCore.mjs';
const sourceTags=new Map(CITY_SOURCE.buildings.map(b=>[b.id.replace(/^way\//,''),b.tags]));
export const AGED_HOUSING=WORLD.buildings.flatMap(b=>{
  if(REFERENCE_BUILDINGS[b.id])return [];
  const era=housingEra(b,b.tags||sourceTags.get(String(b.id))||{});
  if(!era)return [];
  const tanks=rooftopTanks(b);
  // Narrow/complex roofs are retained unchanged for manual review.
  if(tanks.length<5)return [];
  return [{...b,era,tanks,x:b.p.reduce((s,p)=>s+p[0]/b.p.length,0),z:b.p.reduce((s,p)=>s+p[1]/b.p.length,0)}];
});
export const AGED_HOUSING_IDS=new Set(AGED_HOUSING.map(b=>String(b.id)));

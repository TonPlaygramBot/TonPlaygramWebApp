import { NEIGHBOURHOOD } from '../tirana-neighbourhood/data.mjs';
import { CITY_PLACES } from '../tirana-city-source/registry.mjs';
import { CITY_SOURCE } from '../tirana-city-source/sourceData.mjs';
import { frontage } from '../tirana-city-source/sourceCore.mjs';

export const BALLET_BUILDING_ID = '443993963';
export const BALLET_CAMPUS_ID = 'way/541840626';
export const GRAMENO_MAP_ID = 'node/9124938870';

// Use the existing owned school, not a second mesh/sign. The anchor is just
// outside the mapped façade, so a pedestrian route does not target its interior.
export function balletSchoolMapPlace(world, existing = [], sites = CITY_PLACES.sites) {
  const matches = sites.filter(s => s.buildingId === BALLET_BUILDING_ID
    && s.sourceId === BALLET_CAMPUS_ID && s.category === 'school');
  if (matches.length !== 1 || world.buildings.filter(b => String(b.id) === BALLET_BUILDING_ID).length !== 1)
    return null;
  if (existing.some(p => p.id === 'ballet-school' || p.id === matches[0].id
    || /shkolla e baletit|shkolla kombëtare koreografike/i.test(p.name))) return null;
  const edge = frontage(matches[0], world.roads, CITY_SOURCE.entrances);
  if (!edge) return null;
  return { id: 'ballet-school', name: 'Shkolla e Baletit · Shkolla Kombëtare Koreografike',
    x: edge.x + edge.nx * 1.8, z: edge.z + edge.nz * 1.8 };
}

// Existing OSM memorial pin stays the single location in both map and renderer.
export function gramenoMemorial(places = NEIGHBOURHOOD.places) {
  const matches = places.filter(p => p.id === GRAMENO_MAP_ID && p.name === 'Mihal Grameno'
     && p.tags?.historic === 'memorial' && p.tags?.memorial === 'bust'
     && Array.isArray(p.point) && p.point.length === 2 && p.point.every(Number.isFinite));
  if (matches.length !== 1) return null;
  const [x,z] = matches[0].point;
  return {x,z};
}

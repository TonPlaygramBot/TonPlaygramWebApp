/** OSM identities and visually researched finishes. Heights without a surveyed
 * source retain the map estimate. No Google imagery is redistributed. */
import { REFERENCE_BUILDINGS } from '../../tirana-city-source/profiles.mjs';
import { BUILDING_SITE, BUILDING_SOURCE_TAGS } from '../../tirana-city-source/registry.mjs';
export const BUILDING_PROFILES = REFERENCE_BUILDINGS;
const palettes = {
  centre: [0xd8c4a5, 0xd4bda4, 0xccb8a3, 0xc2c4b7, 0xcba68d],
  blloku: [0xd8b789, 0xc6b3a6, 0xb1bbb5, 0xddc5a6, 0xce9d86],
  lana: [0xdbb79c, 0xa8b6b1, 0xd8cdba, 0xcabbad, 0xc6a4a0]
};
export function buildingProfile(b) {
  if (BUILDING_PROFILES[b.id]) return BUILDING_PROFILES[b.id];
  const x = b.p.reduce((s, p) => s + p[0], 0) / b.p.length;
  const z = b.p.reduce((s, p) => s + p[1], 0) / b.p.length;
  const site = BUILDING_SITE.get(String(b.id));
  const tags = BUILDING_SOURCE_TAGS.get(String(b.id)) || {};
  const palette = z > 740 && x < 150 ? palettes.blloku : z > 470 ? palettes.lana : palettes.centre;
  const seed = Array.from(String(b.id)).reduce((s, v) => (s * 31 + v.charCodeAt(0)) >>> 0, 7);
  const taggedColor = /^#[0-9a-f]{6}$/i.test(tags['building:colour'] || '') ? parseInt(tags['building:colour'].slice(1), 16) : null;
  // A tenant in a tower does not turn that entire tower into an embassy facade.
  const institutional = site && site.match !== 'unique-containing-footprint' && !['hotel','casino'].includes(site.category);
  return { name: b.name, color: taggedColor ?? palette[seed % palette.length], trim: 0xdfd8c8,
    floor: 3.2, window: 1.3, style: b.h > 45 ? 'tower' : institutional ? 'institution' : tags.tourism === 'hotel' ? 'hotel' : 'residential', source: 'OSM footprint; district palette approximation' };
}

export function polygonContains(x, z, polygon, holes = []) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside && !holes.some(hole => polygonContains(x, z, hole));
}

export function footprintDistance(x, z, polygon, holes = []) {
  const hole = holes.find(hole => polygonContains(x, z, hole));
  if (hole) polygon = hole;
  else if (polygonContains(x, z, polygon)) return 0;
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return distance;
}

/** OSM identities and visually researched finishes. Heights without a surveyed
 * source retain the map estimate. No Google imagery is redistributed. */
export const BUILDING_PROFILES = Object.freeze({
  '1249637844': { name: 'Pallati i Kulturës', color: 0xdbd2ba, trim: 0xe9e0c9,
    floor: 4.6, window: 2.2, height: 18, style: 'culture', source: 'https://51n4e.com/projects/skanderbeg-square/' },
  '236566880': { name: 'Banka e Shqipërisë', color: 0x9a5641, trim: 0xe4dac7,
    floor: 5, window: 1.8, style: 'bank', source: 'https://www.bankofalbania.org/rc/doc/The_Building_of_the_Bank_of_Albania_3282_2_6832.pdf' },
  '175108137': { name: 'Bashkia Tiranë', color: 0xd4a273, trim: 0xe8d7b7,
    floor: 3.6, window: 1.4, style: 'civic', source: 'https://www.openstreetmap.org/way/175108137' },
  '236566876': { name: 'Tirana International Hotel', color: 0xdde0d8, trim: 0xddd9ca,
    floor: 3.1, window: 1.8, style: 'hotel', source: 'https://www.google.com/maps/@41.3292771,19.8183301,3a,90y,180h,90t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgICkjMLj0QE!2e10!7i6432!8i3216' }
});
const palettes = {
  centre: [0xd8c4a5, 0xd4bda4, 0xccb8a3, 0xc2c4b7, 0xcba68d],
  blloku: [0xd8b789, 0xc6b3a6, 0xb1bbb5, 0xddc5a6, 0xce9d86],
  lana: [0xdbb79c, 0xa8b6b1, 0xd8cdba, 0xcabbad, 0xc6a4a0]
};
export function buildingProfile(b) {
  if (BUILDING_PROFILES[b.id]) return BUILDING_PROFILES[b.id];
  const x = b.p.reduce((s, p) => s + p[0], 0) / b.p.length;
  const z = b.p.reduce((s, p) => s + p[1], 0) / b.p.length;
  const palette = z > 740 && x < 150 ? palettes.blloku : z > 470 ? palettes.lana : palettes.centre;
  const seed = Array.from(String(b.id)).reduce((s, v) => (s * 31 + v.charCodeAt(0)) >>> 0, 7);
  return { name: b.name, color: palette[seed % palette.length], trim: 0xdfd8c8,
    floor: 3.2, window: 1.3, style: b.h > 45 ? 'tower' : 'residential', source: 'OSM footprint; district palette approximation' };
}

export function polygonContains(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function footprintDistance(x, z, polygon) {
  if (polygonContains(x, z, polygon)) return 0;
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return distance;
}

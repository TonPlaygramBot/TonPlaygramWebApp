// Visual art zones, NOT administrative boundaries or measured facade colours.
// Anchor positions use the existing Tirana WORLD metre frame [41.3275, 19.8188].
// Built-in map references: Skënderbej origin, Era Blloku, Grand Pazar, Ali Demi
// bust, Brryli bridge, Star Hotel (Astir), Kombinat fire station, Rruga Selita e
// Vjetër, Rruga Alliasi, Bar Kinostudio and Rruga Sauku. No new imagery/data.
export const PALETTES = Object.freeze([
 ['qendra',0,0,440,[0xd6c9b7,0xd1beaa,0xbcb8ad,0xdbd0bd,0xc8c6be]],
 ['blloku',-344,821,610,[0xe0d5c4,0xbfc5c1,0xc3af9f,0xd8cdc0,0xc6c1b6]],
 ['pazari',464,-347,600,[0xd3b697,0xc9ac99,0xd8c5a9,0xc8c3ab,0xc8b5a6]],
 ['ali-demi',1060,-20,650,[0xcab5a0,0xc8b9a7,0xbcbaa9,0xd1b58f,0xb9b4ae]],
 ['brryli',1311,-314,440,[0xc6b2a6,0xc6c4b5,0xd0bb9f,0xc2b4a3,0xbcbdba]],
 ['astir',-3044,-709,1150,[0xc6c9c5,0xd0cbc1,0xb9bcb7,0xd7cab6,0xc5b8af]],
 ['kombinat',-4095,1878,1250,[0xc0b09a,0xbcbab1,0xc9b4a1,0xc2baa9,0xc9c7be]],
 ['selita',-955,2184,1200,[0xd1c1a7,0xc8b9a4,0xc3c1af,0xd4c2b0,0xc3b6a7]],
 ['allias',998,-2272,920,[0xcfc2aa,0xc0bdb2,0xcbb29c,0xc7bead,0xc4b5a6]],
 ['kinostudio',2347,-2179,1100,[0xc8beac,0xc7b49f,0xbec1b6,0xccc5ad,0xc2b6ae]],
 ['sauk',3025,-667,950,[0xd6c9b0,0xcfc1b3,0xc3c4b5,0xcaba9e,0xcdc1af]],
]);
const GENERAL = [0xcbbfa8,0xcebea9,0xc3c4b9,0xd0bfa7,0xc2b7a8];
const BACKDROP = {
 north:[0xc9bdae,0xc1c2b8,0xcdbfaa,0xd1c4b1,0xbeb4aa],
 east:[0xd4c1a6,0xc1beae,0xcdb5a1,0xcdc4b5,0xbebaaa],
 south:[0xd0c1a7,0xc5bfae,0xd6c6b2,0xc9b9a5,0xc6c4b5],
 west:[0xc3c4b8,0xc9b8a9,0xb9bdb4,0xcfc1ad,0xc6b8ae],
};
const PROTECTED_TYPES = new Set(['construction','ruins','roof','shed','garage','greenhouse','church','mosque','cathedral','civic','government','public','industrial','warehouse']);
export function canStyleBuilding(b) {
 const t = b.tags || {};
 return !b.special && !t['building:colour'] && !t['building:material'] && !t.construction && !t.historic &&
   !t.amenity && !t.military && !PROTECTED_TYPES.has(t.building);
}
export function districtFinish(points, id) {
 if (!points?.length) return {zone:'base', color:GENERAL[0], strength:0};
 let x = 0, z = 0;
 for (const p of points) { x += p[0]; z += p[1]; }
 x /= points.length; z /= points.length;
 // A bounded nearest-anchor influence with falloff avoids hard colour borders.
 let strongest = 0, zone = 'base', colors = GENERAL;
 for (const [name,cx,cz,radius,palette] of PALETTES) {
  const score = 1 - ((x-cx)**2 + (z-cz)**2) / radius**2;
  if (score > strongest) { strongest = score; zone = name; colors = palette; }
 }
 let seed = 2166136261;
 for (const ch of String(id)) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
 const index = (seed >>> 0) % GENERAL.length;
 const backdrop = Math.abs(x) > Math.abs(z) ? (x < 0 ? 'west' : 'east') : (z < 0 ? 'north' : 'south');
 // Maintain a restrained base palette across the entire mapped extent.
 const falloff = Math.min(1,strongest*1.5), near = colors[index], far = BACKDROP[backdrop][index];
 const channel = shift => Math.round(((far>>shift)&255)*(1-falloff) + ((near>>shift)&255)*falloff);
 return { zone:zone==='base'?backdrop:zone, color:(channel(16)<<16)|(channel(8)<<8)|channel(0),
  strength:.32+.68*falloff };
}

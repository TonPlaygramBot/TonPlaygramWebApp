import type { CanopyTree } from '../tirana-street-life/canopyRegistry.mjs';

// Authored additions on the game's OpenStreetMap-derived street geometry.
// These locations fill visual gaps; they are not a survey of live trunks.
const streets = [
  ["Rruga Petro Nini Luarasi", [[1220.49, 205.19], [1287.97, 208.24], [681.11, 230.31], [882.18, 215.78], [1128.7, 171.99], [692.46, 241.44], [1234.75, 206.73], [1272.54, 208.71], [1085.18, 166.82], [891.56, 223.44], [1140.83, 176.43], [736.41, 229.81], [619.7, 207.94], [1281.57, 199.07], [1267.32, 198.97], [1010.06, 187.09], [670.97, 226.03], [1245.41, 207.52]]],
  // Three authored trunks were inside a 9 m junction-visibility buffer.
  // They stay on their former sides of Ali Demi, clear of lights and paths.
  ["Rruga Ali Demi", [[1350.27, 10.53], [861.02, -31.33], [1319.49, 9], [926.84, -22.24], [1476.34, -81.41], [1123.17, -28.79], [1357.41, -2.52]]],
  ["Rruga Mihal Grameno", [[1079.89, 362.8], [834.14, 405.84], [1241.33, 400.09], [1641.41, 229.47], [1173.08, 374.26], [846.17, 419.33]]],
  ["Rruga Bajram Allaraj", [[1643.17, 508.19], [1648.88, 497.49], [1673.57, 493.65], [1659.81, 496]]],
  ["Rruga Shyqyri Ishmi", [[717.82, 97.76], [1085.85, 51.92], [1058.42, 27.55], [937.4, 128.82]]],
  ["Rruga Dalip Zavalani", [[1077.06, 224.75], [1046.33, 193.97], [981.79, 242.36], [1036.49, 201.9]]],
] as const;

export const SOLO_STREET_TREE_INFILL: readonly CanopyTree[] = streets.flatMap(
  ([street, points], streetIndex) => points.map(([x, z], i) => ({
    id: `solo-verge-tree/${streetIndex}/${i}`,
    x, z, seed: 2417 + streetIndex * 83 + i,
    shape: 'umbrella', height: 8.4 + (i % 5) * .58, crown: 4.6 + (i % 3) * .33,
    zone: 'authored-old-street-verge',
    accuracy: `Authored visual infill along ${street}; OSM-derived road geometry.`,
  }))
);

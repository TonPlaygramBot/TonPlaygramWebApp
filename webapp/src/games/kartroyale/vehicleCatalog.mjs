/** One kart-only roster, shared by the garage, AI and authoritative server.
 * Old car selections are migrated by normalizeKart; city traffic is independent. */
export const KARTS = [
  { id: 'apex', name: 'Apex Sprint', detail: 'Balanced · Your first podium', speed: 1, handling: 1.06, brake: 1, shield: 0, ammunition: 0 },
  { id: 'oobi', name: 'Eagle Shifter', detail: 'Speed · Own the straight', speed: 1.08, handling: .96, brake: .96, shield: 0, ammunition: 0 },
  { id: 'oodi', name: 'Illyrian Drift', detail: 'Handling · Chase the perfect drift', speed: .98, handling: 1.18, brake: 1.05, shield: 0, ammunition: 0 },
  { id: 'ooli', name: 'Besa Endurance', detail: 'Control · Smooth through every turn', speed: .96, handling: 1.1, brake: 1.15, shield: 0, ammunition: 0 },
  { id: 'oopi', name: 'Dajti Cross', detail: 'Acceleration · Quick off the grid', speed: 1.03, handling: 1.02, brake: 1.02, shield: 0, ammunition: 0 }
];

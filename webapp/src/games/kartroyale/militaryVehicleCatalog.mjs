/** Arcade tuning shared by browser and server. Armour is a game shield rating,
 * not a statement about real-world ballistic certification or performance. */
export const MILITARY_VEHICLES = Object.freeze([
  {
    id: 'shota',
    name: 'SHOTA',
    detail: 'Albanian 4×4 · heavy protection',
    speed: 0.9,
    handling: 0.88,
    brake: 1.1,
    shield: 100,
    ammunition: 2
  },
  {
    id: 'brabus-g',
    name: 'BRABUS G-Wagen',
    detail: 'Armoured G-Class · fast convoy SUV',
    speed: 1.03,
    handling: 0.94,
    brake: 1.02,
    shield: 94,
    ammunition: 3
  },
  {
    id: 'defender',
    name: 'Land Rover Defender',
    detail: 'Defender 110 · agile expedition 4×4',
    speed: 0.95,
    handling: 1.06,
    brake: 1.08,
    shield: 90,
    ammunition: 3
  },
  {
    id: 'brabus-s65',
    name: 'BRABUS S65',
    detail: 'Bulletproof edition · armoured sedan',
    speed: 1.1,
    handling: 0.97,
    brake: 1.03,
    shield: 86,
    ammunition: 2
  }
]);
export const isMilitaryVehicle = (id) =>
  MILITARY_VEHICLES.some((v) => v.id === id);

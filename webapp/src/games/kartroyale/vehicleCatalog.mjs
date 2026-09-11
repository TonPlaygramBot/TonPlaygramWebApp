import { MILITARY_VEHICLES } from './militaryVehicleCatalog.mjs';
import { VEHICLE_COLLECTION } from '../tiranastreets/shared/vehicleCollection.mjs';

const STREET_CAR_TUNING = Object.freeze({
  benz: [1.08, .94, 1.08, 82], bmw: [1.14, 1.06, 1.08, 72],
  range: [.98, .9, 1.06, 100], audi: [1.09, .98, 1.1, 84],
  ford: [1.01, 1.08, 1.04, 76], fiat: [.96, 1.13, 1.02, 68],
  jaguar: [1.1, 1.01, 1.08, 82], ferrari: [1.18, 1.04, 1.13, 66],
  bugatti: [1.2, .98, 1.12, 70], landrover: [.96, .92, 1.08, 100]
});

/** The showroom is fed by the same checked-in, metre-scale collection used by
 * Tirana Streets. Gameplay tuning stays local to Racing Royal. */
export const STREET_VEHICLES = VEHICLE_COLLECTION.map((vehicle) => {
  const [speed, handling, brake, shield] = STREET_CAR_TUNING[vehicle.id];
  return { id: vehicle.id, name: vehicle.name, detail: 'Tirana Streets collection',
    speed, handling, brake, shield, ammunition: 3 };
});
export const KARTS = [
  { id: 'apex', name: 'Apex Sprint', detail: 'Open tubular sprint chassis', speed: 1, handling: 1, brake: 1, shield: 80, ammunition: 3 },
  { id: 'oobi', name: 'Eagle Shifter', detail: 'Radiator and manual shifter', speed: 1.1, handling: .93, brake: .94, shield: 62, ammunition: 3 },
  { id: 'oodi', name: 'Illyrian Drift', detail: 'Low wing and drift chassis', speed: .97, handling: 1.12, brake: 1.05, shield: 70, ammunition: 4 },
  { id: 'ooli', name: 'Besa Endurance', detail: 'Faired endurance racer', speed: .92, handling: .9, brake: 1.12, shield: 100, ammunition: 2 },
  { id: 'oopi', name: 'Dajti Cross', detail: 'Knobby tyres and roll hoop', speed: 1.05, handling: 1.03, brake: .98, shield: 72, ammunition: 5 },
  {id:'buggy',name:'Go-Kart Buggy',detail:'Open-wheel buggy',speed:.98,handling:1.16,brake:1.03,shield:70,ammunition:4},
  ...STREET_VEHICLES,
  ...MILITARY_VEHICLES
];

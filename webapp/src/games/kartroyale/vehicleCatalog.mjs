import { MILITARY_VEHICLES } from './militaryVehicleCatalog.mjs';
export const KARTS = [
  { id: 'apex', name: 'Apex Sprint', detail: 'Open tubular sprint chassis', speed: 1, handling: 1, brake: 1, shield: 80, ammunition: 3 },
  { id: 'oobi', name: 'Eagle Shifter', detail: 'Radiator and manual shifter', speed: 1.1, handling: .93, brake: .94, shield: 62, ammunition: 3 },
  { id: 'oodi', name: 'Illyrian Drift', detail: 'Low wing and drift chassis', speed: .97, handling: 1.12, brake: 1.05, shield: 70, ammunition: 4 },
  { id: 'ooli', name: 'Besa Endurance', detail: 'Faired endurance racer', speed: .92, handling: .9, brake: 1.12, shield: 100, ammunition: 2 },
  { id: 'oopi', name: 'Dajti Cross', detail: 'Knobby tyres and roll hoop', speed: 1.05, handling: 1.03, brake: .98, shield: 72, ammunition: 5 },
  {id:'ferrari',name:'Ferrari',detail:'Ferrari sports car',speed:1.16,handling:.93,brake:1.12,shield:65,ammunition:3},
  {id:'buggy',name:'Go-Kart Buggy',detail:'Open-wheel buggy',speed:.98,handling:1.16,brake:1.03,shield:70,ammunition:4},
  ...MILITARY_VEHICLES
];

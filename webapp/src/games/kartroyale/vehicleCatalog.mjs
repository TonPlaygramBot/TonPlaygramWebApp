import { MILITARY_VEHICLES } from './militaryVehicleCatalog.mjs';
export const KARTS = [
  { id: 'apex', name: 'Apex 02', detail: 'Balanced mechanical kart', speed: 1, handling: 1, brake: 1, shield: 80, ammunition: 3 },
  { id: 'oobi', name: 'Eagle', detail: 'Fast sprint chassis', speed: 1.1, handling: .93, brake: .94, shield: 62, ammunition: 3 },
  { id: 'oodi', name: 'Illyrian', detail: 'Agile road racer', speed: .97, handling: 1.12, brake: 1.05, shield: 70, ammunition: 4 },
  { id: 'ooli', name: 'Besa', detail: 'Armoured touring kart', speed: .92, handling: .9, brake: 1.12, shield: 100, ammunition: 2 },
  { id: 'oopi', name: 'Dajti', detail: 'Aero attack kart', speed: 1.05, handling: 1.03, brake: .98, shield: 72, ammunition: 5 },
  {id:'ferrari',name:'Ferrari',detail:'Ferrari sports car',speed:1.16,handling:.93,brake:1.12,shield:65,ammunition:3},
  {id:'buggy',name:'Go-Kart Buggy',detail:'Open-wheel buggy',speed:.98,handling:1.16,brake:1.03,shield:70,ammunition:4},
  ...MILITARY_VEHICLES
];

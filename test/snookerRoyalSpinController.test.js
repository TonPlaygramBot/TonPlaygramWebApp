import { mapSpinForPhysics as mapPoolSpinForPhysics } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import { mapSpinForPhysics as mapSnookerSpinForPhysics } from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

const SPIN_SAMPLES = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: -0.45, y: 0.7 },
  { x: 0.9, y: -0.25 }
];

describe('Snooker Royal spin controller mapping', () => {
  it('matches Pool Royale spin directions and physics response', () => {
    for (const sample of SPIN_SAMPLES) {
      expect(mapSnookerSpinForPhysics(sample)).toEqual(mapPoolSpinForPhysics(sample));
    }
  });
});

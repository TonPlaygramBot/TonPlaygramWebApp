import * as poolSpin from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import * as snookerSpin from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';
import { readFile } from 'node:fs/promises';

describe('Snooker Royal aiming experience', () => {
  test('matches Pool Royale spin controller constants and mapping', () => {
    [
      'MAX_SPIN_OFFSET',
      'SPIN_STUN_RADIUS',
      'SPIN_RING1_RADIUS',
      'SPIN_RING2_RADIUS',
      'SPIN_RING3_RADIUS',
      'SPIN_RESPONSE_EXPONENT',
      'SPIN_CENTER_TOPSPIN_BIAS'
    ].forEach((key) => expect(snookerSpin[key]).toBe(poolSpin[key]));

    const samples = [
      { x: 0, y: 0 },
      { x: -0.72, y: 0.48 },
      { x: 0.35, y: -0.91 },
      { x: 1, y: 1 }
    ];
    samples.forEach((spin) => {
      expect(snookerSpin.normalizeSpinInput(spin)).toEqual(
        poolSpin.normalizeSpinInput(spin)
      );
      expect(snookerSpin.mapSpinForPhysics(spin)).toEqual(
        poolSpin.mapSpinForPhysics(spin)
      );
    });
  });

  test('keeps the cue visible in the closer standing camera', async () => {
    const source = await readFile('webapp/src/pages/Games/SnookerRoyal.jsx', 'utf8');

    expect(source).toContain('const STANDING_VIEW_DISTANCE_SCALE = 0.135;');
    expect(source).toContain('tableCueVisible: Boolean(cueStick.visible)');
    expect(source).not.toContain(
      'tableCueVisible: Boolean(cueStick.visible && (cameraBlendRef.current ?? 1) <= 0.55)'
    );
  });
});

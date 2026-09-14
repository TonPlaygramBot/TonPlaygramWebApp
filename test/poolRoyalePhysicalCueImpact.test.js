import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(here, '../webapp/src/pages/Games/PoolRoyale.jsx'),
  'utf8'
);

describe('Pool Royale physical cue impact wiring', () => {
  it('does not launch the cue ball before the visible cue reaches contact', () => {
    const payloadStart = source.indexOf('const shotImpactPayload = {');
    const impactGuard = source.indexOf('let shotImpactApplied = false;', payloadStart);

    expect(payloadStart).toBeGreaterThan(-1);
    expect(impactGuard).toBeGreaterThan(payloadStart);
    expect(source.slice(payloadStart, impactGuard)).not.toContain(
      'applyShotAtImpact(shotImpactPayload);'
    );
  });

  it('applies physics through the one-shot contact callback', () => {
    const impactGuard = source.indexOf('let shotImpactApplied = false;');
    const strokeEnd = source.indexOf('cueStrokeStateRef.current = {', impactGuard);
    const impactCallback = source.indexOf(
      'onImpact: () => applyShotImpactOnce()',
      strokeEnd
    );

    expect(impactGuard).toBeGreaterThan(-1);
    expect(strokeEnd).toBeGreaterThan(impactGuard);
    expect(impactCallback).toBeGreaterThan(strokeEnd);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../webapp/src/games/tirana-environment/ParkAttractions.ts',
    import.meta.url
  ),
  'utf8'
);
const integration = fs.readFileSync(
  new URL(
    '../webapp/src/games/tirana-expansion/WorldEnhancements.ts',
    import.meta.url
  ),
  'utf8'
);

test('shared Tirana layer includes animated park landmarks', () => {
  assert.match(source, /Parku Rinia fountain basin/);
  assert.match(source, /Grand Park observation wheel/);
  assert.match(source, /Grand Park carousel/);
  assert.match(source, /battery/);
  assert.match(
    integration,
    /attractions\.update\(seconds,\s*viewer,\s*battery\)/
  );
  assert.match(integration, /attractions\.dispose\(\)/);
});

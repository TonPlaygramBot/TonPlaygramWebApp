import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url),
  'utf8'
);

test('Snooker Royal caps HDRI choices at 4K', () => {
  const options = source.match(
    /const HDRI_RESOLUTION_OPTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/
  )?.[1];

  assert.ok(options, 'HDRI options remain discoverable');
  assert.doesNotMatch(options, /(?:6K|8K|'6k'|'8k')/);
  assert.match(options, /'auto'/);
  assert.match(options, /'4k'/);
  assert.match(options, /'2k'/);
  assert.match(source, /function resolveHdriResolutionForTable[\s\S]*?return '4k';/);
});

test('Snooker Royal AI evaluates position from the first shot of every visit', () => {
  assert.match(
    source,
    /const shouldAnalyzeLeave =\s*aiOpponentEnabled && hudRef\.current\?\.turn === 1;/
  );
  assert.match(source, /plannedTarget === 'RED'[\s\S]*?'YELLOW'[\s\S]*?'BLACK'/);
  assert.match(source, /const leaveWeight = shouldAnalyzeLeave \? 0\.2 : 0;/);
});

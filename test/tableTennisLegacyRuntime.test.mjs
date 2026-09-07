import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(
  'webapp/src/pages/Games/TableTennisRoyal.jsx',
  'utf8'
);
const lobby = fs.readFileSync(
  'webapp/src/pages/Games/TableTennisRoyalLobby.jsx',
  'utf8'
);
const runtime = fs.readFileSync(
  'webapp/src/games/tabletennis/Game.tsx',
  'utf8'
);

test('solo and online route through the same metre-based swipe runtime', () => {
  assert.doesNotMatch(page, /LegacyTableTennisGame/);
  assert.match(page, /<TableTennisGame/);
  assert.match(page, /ownedAppearance/);
  assert.match(runtime, /onPointerUp=\{pointerUp\}/);
  assert.match(runtime, /BroadcastScoreboard/);
});

test('TPG matchmaking and authoritative online runtime remain connected', () => {
  assert.match(lobby, /gameType: 'tabletennisroyal'/);
  assert.match(lobby, /tokens=\{\['TPG'\]\}/);
  assert.match(page, /if \(launch\.mode === 'ai'\) return undefined/);
  assert.match(page, /services\.activate\(\)/);
  assert.match(page, /<TableTennisGame/);
});

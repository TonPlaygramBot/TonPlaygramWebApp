import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('webapp/src/pages/Games/TableTennisRoyal.jsx', 'utf8');
const lobby = fs.readFileSync('webapp/src/pages/Games/TableTennisRoyalLobby.jsx', 'utf8');
const legacy = fs.readFileSync('webapp/src/games/tabletennis/LegacyGame.tsx', 'utf8');

test('solo table tennis uses the restored portrait game', () => {
  assert.match(page, /if \(launch\.mode === 'ai'\) return <LegacyTableTennisGame \/>/);
  assert.match(legacy, /export default function MobileRealisticTableTennisGame/);
  assert.match(legacy, /Swipe up to serve/);
  assert.match(legacy, /camera\.aspect < 0\.72/);
});

test('TPG matchmaking and authoritative online runtime remain connected', () => {
  assert.match(lobby, /gameType: 'tabletennisroyal'/);
  assert.match(lobby, /tokens=\{\['TPG'\]\}/);
  assert.match(page, /if \(launch\.mode === 'ai'\) return undefined/);
  assert.match(page, /services\.activate\(\)/);
  assert.match(page, /<TableTennisGame/);
});

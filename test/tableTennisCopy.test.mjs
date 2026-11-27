import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
test('Table Tennis player-facing copy does not label account, match or settlement TPC',()=>{
  const names=['webapp/src/games/tabletennis/Game.tsx','webapp/src/games/tabletennis/services.ts','webapp/src/pages/Games/TableTennisRoyalLobby.jsx'];
  const [game,services,lobby]=names.map(f=>readFileSync(new URL('../'+f,import.meta.url),'utf8'));
  assert.doesNotMatch([game,services,lobby].join('\n'),/\bTPC\b/);
  assert.match(game,/TPG MATCH/);
  assert.match(services,/TonPlayGram account/);
  assert.match(lobby,/tokens=\{\['TPG'\]\}/);
  assert.match(lobby,/two fingers for\s+backspin/);
});

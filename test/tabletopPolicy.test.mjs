import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSeatTableRequest,
  buildReadinessSnapshot
} from '../bot/config/onlineGamePolicy.js';
import { TABLETOP_IDS } from '../webapp/src/games/tabletop/shared/catalog.mjs';
for (const gameType of TABLETOP_IDS)
  test(`${gameType}: TPG queue criteria`, () => {
    for (const maxPlayers of [2, 3, 4])
      assert.equal(
        validateSeatTableRequest({
          gameType,
          maxPlayers,
          stake: 100,
          matchMeta: { format: 'classic', token: 'TPG', mode: 'online' }
        }).ok,
        true
      );
    for (const change of [
      { stake: 0 },
      { stake: 1.2 },
      { stake: Number.MAX_SAFE_INTEGER },
      { maxPlayers: 5 },
      { matchMeta: { format: 'wrong', mode: 'online', token: 'TPG' } },
      { matchMeta: { format: 'classic', mode: 'ai', token: 'TPG' } },
      { matchMeta: { format: 'classic', mode: 'online', token: 'TON' } }
    ])
      assert.equal(
        validateSeatTableRequest({
          gameType,
          maxPlayers: 2,
          stake: 100,
          matchMeta: { format: 'classic', token: 'TPG', mode: 'online' },
          ...change
        }).ok,
        false
      );
    assert.deepEqual(buildReadinessSnapshot()[gameType].maxPlayers, [2, 3, 4]);
  });

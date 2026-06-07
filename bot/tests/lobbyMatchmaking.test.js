import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLobbyMatchKey,
  isMatchMetaCompatible,
  normalizeMatchMeta
} from '../utils/lobbyMatchmaking.js';

test('normalizes chess lobby metadata used for table criteria', () => {
  assert.deepEqual(
    normalizeMatchMeta({ mode: ' Online ', token: ' tpc ', preferredSide: 'white' }),
    { mode: 'online', token: 'tpc' }
  );
});

test('requires Chess Battle Royal core lobby criteria to match exactly', () => {
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc' },
      { mode: 'online', token: 'tpc' },
      'chess'
    ),
    true
  );
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc' },
      { mode: 'online', token: 'ton' },
      'chess'
    ),
    false
  );
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc' },
      { mode: 'online' },
      'chess'
    ),
    false
  );
});

test('keeps quick and private lobby table buckets separate', () => {
  const base = {
    gameType: 'chess',
    stake: 100,
    maxPlayers: 2,
    matchMeta: { mode: 'online', token: 'TPC' }
  };

  const quickKey = buildLobbyMatchKey(base);
  const sameQuickKey = buildLobbyMatchKey({
    ...base,
    matchMeta: { token: 'tpc', mode: 'ONLINE' }
  });
  const privateKey = buildLobbyMatchKey({
    ...base,
    forcedTableId: 'chess-2-host-ABC'
  });

  assert.equal(quickKey, sameQuickKey);
  assert.notEqual(quickKey, privateKey);
});

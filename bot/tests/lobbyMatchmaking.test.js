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

test('requires Domino Royal quick matches to share stake seats and criteria', () => {
  const base = {
    gameType: 'domino-royal',
    stake: 100,
    maxPlayers: 4,
    matchMeta: { mode: 'online', token: 'TPC', variant: 'points', targetPoints: 51 }
  };

  const sameCriteria = buildLobbyMatchKey({
    ...base,
    matchMeta: { mode: 'ONLINE', token: 'tpc', variant: ' Points ', targetPoints: '51' }
  });

  assert.equal(buildLobbyMatchKey(base), sameCriteria);
  assert.notEqual(buildLobbyMatchKey(base), buildLobbyMatchKey({ ...base, stake: 250 }));
  assert.notEqual(buildLobbyMatchKey(base), buildLobbyMatchKey({ ...base, maxPlayers: 3 }));
  assert.notEqual(
    buildLobbyMatchKey(base),
    buildLobbyMatchKey({ ...base, matchMeta: { ...base.matchMeta, targetPoints: 101 } })
  );
});

test('requires Domino Royal mode token and variant on legacy compatibility checks', () => {
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc', variant: 'single', targetPoints: '0' },
      { mode: 'online', token: 'tpc', variant: 'single', targetPoints: '0' },
      'domino-royal'
    ),
    true
  );
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc', variant: 'single', targetPoints: '0' },
      { mode: 'online', token: 'tpc', targetPoints: '0' },
      'domino-royal'
    ),
    false
  );
  assert.equal(
    isMatchMetaCompatible(
      { mode: 'online', token: 'tpc', variant: 'single', targetPoints: '0' },
      { mode: 'online', token: 'ton', variant: 'single', targetPoints: '0' },
      'domino-royal'
    ),
    false
  );
});

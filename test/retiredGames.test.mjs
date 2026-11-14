import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';

test('retired game clients cannot create paid tables; Racing remains available', () => {
  const request = { stake: 100, maxPlayers: 2, matchMeta: { token: 'TPG', mode: 'online', trackId: 'skanderbeg' } };
  for (const gameType of ['blackwater', 'tiranastreets', 'jetskiroyal']) {
    assert.equal(validateSeatTableRequest({ ...request, gameType }).ok, false, gameType);
  }
  assert.equal(validateSeatTableRequest({ ...request, gameType: 'kartroyale' }).ok, true);
});

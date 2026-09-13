import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTabletop } from '../services/tabletop.js';
import { TABLETOP_IDS } from '../../webapp/src/games/tabletop/shared/catalog.mjs';
import {
  legalActions,
  activePlayer,
  chooseAiAction
} from '../../webapp/src/games/tabletop/shared/engine.mjs';
function setup(gameId = 'oligarchs', count = 2) {
  let now = 100000,
    handler;
  const events = [],
    settlements = [];
  const io = {
    on: (name, fn) => (handler = fn),
    off() {},
    to: (id) => ({ emit: (name, data) => events.push({ id, name, data }) })
  };
  const runtime = attachTabletop(io, {
    clock: () => now,
    autoTick: false,
    settleMatch: async (game, id, outcome) => {
      settlements.push({ game, id, ...outcome });
      return { status: outcome.winnerAccountId ? 'paid' : 'refunded' };
    }
  });
  runtime.createMatch({
    id: 'table',
    gameType: gameId,
    stake: 100,
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`
    }))
  });
  function socket(id, suffix = '') {
    const handlers = {};
    const s = {
      id: `socket-${id}${suffix}`,
      data: { playerId: id },
      on: (event, fn) => (handlers[event] = fn)
    };
    handler(s);
    return {
      s,
      call: (event, data = {}) => {
        let ack;
        handlers[event]?.(data, (r) => (ack = r));
        return ack;
      }
    };
  }
  const clients = Array.from({ length: count }, (_, i) => socket(`p${i}`));
  return {
    runtime,
    clients,
    socket,
    events,
    settlements,
    advance: (ms) => (now += ms),
    join: () =>
      clients.forEach((c) =>
        assert.equal(
          c.call('tabletop:join', { tableId: 'table', gameId }).ok,
          true
        )
      )
  };
}
for (const gameId of TABLETOP_IDS)
  test(`${gameId} online: all players receive private action sets and finish one settlement`, async () => {
    const f = setup(gameId, 4);
    f.join();
    let moves = 0;
    while (
      f.runtime.rooms.get('table').status === 'playing' &&
      moves++ < 3000
    ) {
      const s = f.runtime.rooms.get('table').game,
        index = s.players.findIndex((p) => p.id === activePlayer(s).id);
      f.advance(150);
      const response = f.clients[index].call('tabletop:action', {
        actionId: chooseAiAction(s),
        revision: s.revision,
        requestId: `r${moves}`
      });
      assert.equal(response.ok, true);
      assert.equal(response.state.rng, undefined);
      assert.equal(response.state.deck, undefined);
    }
    assert.ok(moves < 3000);
    await Promise.resolve();
    assert.equal(f.settlements.length, 1);
    f.runtime.tick();
    assert.equal(f.settlements.length, 1);
    f.runtime.close();
  });
test('Rejects unauthorized seats, stale commands, forged winners and duplicates', () => {
  const f = setup();
  assert.equal(
    f
      .socket('outsider')
      .call('tabletop:join', { tableId: 'table', gameId: 'oligarchs' }).ok,
    false
  );
  f.join();
  const move = {
    actionId: 'roll',
    revision: 0,
    requestId: 'same',
    winnerAccountId: 'p0',
    dice: [6, 6]
  };
  assert.equal(
    f.clients[1].call('tabletop:action', move).error,
    'not_your_turn'
  );
  assert.equal(f.clients[0].call('tabletop:action', move).ok, true);
  assert.equal(f.clients[0].call('tabletop:action', move).duplicate, true);
  assert.equal(f.runtime.rooms.get('table').game.revision, 1);
  f.advance(200);
  assert.equal(
    f.clients[0].call('tabletop:action', { ...move, requestId: 'new' }).error,
    'stale_revision'
  );
  assert.deepEqual(f.settlements, []);
});
test('Reconnect replaces old device; spectator cannot take a turn', () => {
  const f = setup();
  f.join();
  const newer = f.socket('p0', 'new');
  assert.equal(
    newer.call('tabletop:join', { tableId: 'table', gameId: 'oligarchs' }).ok,
    true
  );
  assert.equal(
    f.clients[0].call('tabletop:action', {
      actionId: 'roll',
      revision: 0,
      requestId: 'r'
    }).ok,
    false
  );
  assert.equal(
    f.events.filter((e) => e.name === 'tabletop:replaced').length,
    1
  );
  assert.equal(
    newer.call('tabletop:action', {
      actionId: 'roll',
      revision: 0,
      requestId: 'r'
    }).ok,
    true
  );
});
test('Incomplete loads and simultaneous disconnects refund; timeout forfeits', async () => {
  let f = setup();
  f.clients[0].call('tabletop:join', { tableId: 'table', gameId: 'oligarchs' });
  f.advance(60001);
  f.runtime.tick();
  await Promise.resolve();
  assert.equal(f.settlements[0].winnerAccountId, '');
  assert.equal(f.settlements[0].reason, 'loading_timeout_refund');
  f = setup();
  f.join();
  f.clients.forEach((c) => c.call('disconnect'));
  f.advance(60001);
  f.runtime.tick();
  await Promise.resolve();
  assert.equal(f.settlements[0].reason, 'all_left_refund');
  f = setup();
  f.join();
  f.advance(60001);
  f.runtime.tick();
  assert.equal(f.settlements[0].winnerAccountId, 'p1');
});
test('Leaving a live 4-player game excludes that seat without paying early', () => {
  const f = setup('harborempires', 4);
  f.join();
  f.clients[0].call('tabletop:leave');
  assert.equal(f.runtime.rooms.get('table').game.players[0].out, true);
  assert.equal(f.runtime.rooms.get('table').game.turn, 1);
  assert.deepEqual(f.settlements, []);
});

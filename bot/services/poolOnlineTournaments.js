import { randomUUID } from 'node:crypto';

// Casual invite tournaments. Match physics uses the existing Pool relay; both
// seated clients must confirm its settled result. Never authorizes wallet prizes.
export function createPoolOnlineTournaments({ io, tableMap, poolStates, now = Date.now }) {
  const events = new Map();
  const memberships = new Map();
  const room = id => `pool-tournament:${id}`;
  const snapshot = event => ({ ...event, entrants: event.entrants.map(({ socketId, ...entrant }) => entrant),
    draw: event.draw.map(round => round.map(({ reports, ...pair }) => ({ ...pair, confirmedCount: Object.keys(reports || {}).length }))) });
  const broadcast = event => { event.updatedAt = now(); io.to(room(event.id)).emit('poolTournamentState', snapshot(event)); };
  function remove(event) {
    for (const entrant of event.entrants) if (memberships.get(entrant.id) === event.id) memberships.delete(entrant.id);
    for (const round of event.draw) for (const pair of round) { tableMap.delete(pair.tableId); poolStates.delete(pair.tableId); }
    events.delete(event.id);
  }
  function sweep() {
    for (const event of events.values()) if (now() - event.updatedAt > 6 * 60 * 60 * 1000) remove(event);
  }
  function makeRound(event, ids) {
    const round = ids.reduce((pairs, id, index) => {
      if (index % 2) return pairs;
      const a = id, b = ids[index + 1], tableId = `pool-tour-${randomUUID()}`;
      const players = [a, b].map(id => ({ ...event.entrants.find(player => player.id === id) }));
      tableMap.set(tableId, { id: tableId, gameType: 'poolroyale', maxPlayers: 2,
        players, ready: new Set([a, b]), started: true, currentTurn: a,
        tournamentId: event.id, stake: { token: 'TPC', amount: 0 },
        meta: { variant: event.variant, tableSize: '9ft', playType: 'regular', mode: 'online' } });
      poolStates.set(tableId, { state: null, layout: null, revision: 0, ts: now() });
      pairs.push({ a, b, tableId, reports: {} });
      return pairs;
    }, []);
    event.draw.push(round);
  }
  function advance(event) {
    const round = event.draw[event.round];
    if (!round.every(pair => pair.winner)) return;
    const winners = round.map(pair => pair.winner);
    if (winners.length === 1) { event.champion = winners[0]; event.status = 'complete'; }
    else { event.round++; makeRound(event, winners); }
  }
  function findPair(event, accountId, tableId) {
    const pair = event.draw.flat().find(pair => pair.tableId === tableId);
    if (!pair || ![pair.a, pair.b].includes(accountId)) throw Error('You are not seated at this match.');
    return pair;
  }
  function act(socket, payload) {
    sweep();
    const accountId = String(socket.data?.playerId || '');
    const bound = String(socket.data?.auth?.accountId || '');
    if (!accountId || !bound || bound !== accountId || payload.accountId !== accountId) throw Error('Sign in to join an online tournament.');
    const action = payload.action;
    let event = events.get(String(payload.id || '').toUpperCase());
    const prior = events.get(memberships.get(accountId));
    if (action === 'create') {
      if (prior && prior.status !== 'complete') throw Error(`You already joined room ${prior.id}. Resume or leave it first.`);
      if (events.size >= 1000) throw Error('Tournament rooms are busy. Try again later.');
      const size = Number(payload.size);
      if (![4, 8, 16, 32].includes(size) || !['american', 'uk', '9ball', 'albanian61'].includes(payload.variant)) throw Error('Choose valid tournament rules and size.');
      let id;
      do { id = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase(); } while (events.has(id));
      event = { id, host: accountId, size, variant: payload.variant, title: 'Royal Online Open',
        status: 'waiting', entrants: [], draw: [], round: 0, totalRounds: Math.log2(size), updatedAt: now() };
      events.set(id, event);
    }
    if (!event) throw Error('Room unavailable or expired. Ask the host for a new invite.');
    let entrant = event.entrants.find(player => player.id === accountId);
    if (action === 'join' || action === 'create') {
      if (!entrant) {
        if (prior && prior.id !== event.id && prior.status !== 'complete') throw Error(`You already joined room ${prior.id}.`);
        if (event.status !== 'waiting' || event.entrants.length >= event.size) throw Error('This draw is full or already started.');
        entrant = { id: accountId, name: String(payload.name || 'Player').trim().slice(0, 32) || 'Player' };
        event.entrants.push(entrant);
        memberships.set(accountId, event.id);
      }
    }
    if (!entrant) throw Error('Join this room first.');
    entrant.socketId = socket.id;
    socket.join(room(event.id));
    if (action === 'start') {
      if (event.host !== accountId) throw Error('Only the host can start the draw.');
      if (event.status !== 'waiting' || event.entrants.length !== event.size) throw Error('Wait until every seat is filled.');
      event.status = 'active';
      // Randomize once on the server. All clients see the same persisted live draw.
      const ids = event.entrants.map(player => player.id);
      for (let index = ids.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [ids[index], ids[other]] = [ids[other], ids[index]];
      }
      makeRound(event, ids);
    } else if (action === 'report') {
      const pair = findPair(event, accountId, payload.tableId);
      if (!pair.winner) {
        const frame = poolStates.get(pair.tableId)?.state;
        if (!frame?.frameOver || !['A', 'B'].includes(frame.winner)) throw Error('The settled rack result has not arrived. Retry in a moment.');
        const winner = frame.winner === 'A' ? pair.a : pair.b;
        if (payload.winner !== frame.winner) throw Error('Results disagree. Rejoin the rack to synchronize.');
        pair.reports[accountId] = winner;
        if (pair.reports[pair.a] === winner && pair.reports[pair.b] === winner) {
          pair.winner = winner; pair.score = winner === pair.a ? [1, 0] : [0, 1];
          advance(event);
        }
      }
    } else if (action === 'forfeit') {
      const pair = findPair(event, accountId, payload.tableId);
      if (!pair.winner) {
        pair.winner = accountId === pair.a ? pair.b : pair.a;
        pair.score = pair.winner === pair.a ? [1, 0] : [0, 1];
        pair.forfeit = true;
        advance(event);
      }
    } else if (action === 'leave') {
      if (event.status === 'active' && event.draw[event.round].some(pair => [pair.a, pair.b].includes(accountId) && (!pair.winner || pair.winner === accountId))) throw Error('Concede your active match before leaving, or wait for your next round.');
      if (event.status === 'waiting') {
        event.entrants = event.entrants.filter(player => player.id !== accountId);
        event.host = event.entrants[0]?.id;
      }
      memberships.delete(accountId);
      socket.leave(room(event.id));
      if (!event.entrants.length) remove(event);
    } else if (!['create', 'join', 'sync', 'start'].includes(action)) throw Error('Unknown tournament action.');
    broadcast(event);
    return snapshot(event);
  }
  function attach(socket) {
    socket.on('poolTournament', (payload = {}, callback) => {
      try { callback?.({ success: true, event: act(socket, payload) }); }
      catch (error) { callback?.({ success: false, error: error.message }); }
    });
  }
  // Freeze a terminal rack and accept settled updates only from its active seat.
  function canUpdate(table, accountId) {
    const event = events.get(table.tournamentId);
    if (!event || event.status !== 'active') return false;
    const pair = event.draw[event.round]?.find(pair => pair.tableId === table.id);
    if (!pair || pair.winner) return false;
    const state = poolStates.get(table.id)?.state;
    if (state?.frameOver) return false;
    return accountId === (state?.activePlayer === 'B' ? pair.b : pair.a);
  }
  return { attach, act, canUpdate, sweep };
}

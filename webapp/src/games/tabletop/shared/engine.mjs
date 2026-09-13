import {
  getTabletopGame,
  RAIL_ROUTES,
  CITY_NAMES,
  RESOURCE_NAMES,
  GEM_NAMES
} from './catalog.mjs';
const clone = (value) => structuredClone(value);
const sum = (values) => values.reduce((a, b) => a + b, 0);
const range = (n) => Array.from({ length: n }, (_, i) => i);
function random(s, max) {
  if (s.entropy?.length) return s.entropy.pop() % max;
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng % max;
}
function shuffle(s, items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random(s, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export const activeSeat = (s) => (s.auction ? s.auction.seat : s.turn);
export const activePlayer = (s) => s.players[activeSeat(s)];
const log = (s, message) => {
  s.log = [...s.log.slice(-11), message];
};
const neighbors = (i) =>
  range(16).filter(
    (j) =>
      Math.abs((i % 4) - (j % 4)) +
        Math.abs(Math.floor(i / 4) - Math.floor(j / 4)) ===
      1
  );
export function createGame(gameId, roster, seed = 1, entropy = []) {
  if (
    !getTabletopGame(gameId) ||
    !Array.isArray(roster) ||
    roster.length < 2 ||
    roster.length > 4 ||
    new Set(roster.map((p) => p.id)).size !== roster.length ||
    roster.some((p) => !p.id)
  )
    throw Error('invalid_game_roster');
  const s = {
    gameId,
    rng: seed >>> 0 || 1,
    entropy: [...entropy],
    turn: 0,
    round: 1,
    revision: 0,
    phase: 'turn',
    done: false,
    winnerAccountId: '',
    log: [],
    players: roster.map((p) => ({
      id: String(p.id),
      name: String(p.name || 'Player').slice(0, 24),
      score: 0,
      cash: 700,
      position: 0,
      out: false,
      resources: [2, 2, 2],
      gems: [0, 0, 0],
      bonuses: [0, 0, 0],
      reserved: [],
      wall: range(5).map(() => Array(5).fill(false)),
      rows: range(5).map(() => ({ color: -1, count: 0 }))
    }))
  };
  if (gameId === 'oligarchs') {
    const names = [
      'Founders Gate',
      'Copper Quay',
      'Amber Row',
      'Opportunity',
      'Linden Walk',
      'Cedar Court',
      'City Levy',
      'Coral Wharf',
      'Pearl Dock',
      'Opportunity',
      'Silk Street',
      'Velvet Avenue',
      'Civic Grant',
      'Silver Hill',
      'Crystal Rise',
      'Opportunity',
      'Orchid Place',
      'Saffron Lane',
      'City Levy',
      'Sapphire Bay',
      'Emerald Pier',
      'Opportunity',
      'Crown Plaza',
      'Summit Square'
    ];
    s.board = names.map((name, i) => ({
      name,
      owner: -1,
      level: 0,
      price: 100 + Math.floor(i / 6) * 40 + (i % 3 === 2 ? 20 : 0),
      district: Math.floor(i / 6) * 2 + (i % 6 >= 4 ? 1 : 0),
      kind:
        i % 6 === 0
          ? i === 0
            ? 'start'
            : i === 12
              ? 'grant'
              : 'tax'
          : i % 6 === 3
            ? 'event'
            : 'property'
    }));
    s.phase = 'roll';
  } else if (gameId === 'harborempires') {
    s.board = range(16).map((i) => ({
      resource: i % 3,
      number: 2 + (i % 5),
      owner: -1,
      level: 0,
      name: `Island ${i + 1}`
    }));
    [12, 3, 0, 15].slice(0, roster.length).forEach((cell, p) => {
      s.board[cell].owner = p;
      s.board[cell].level = 1;
      s.players[p].score = 1;
    });
    s.phase = 'roll';
  } else if (gameId === 'mosaicroyal') refillMosaic(s);
  else if (gameId === 'railkingdoms') {
    s.routes = RAIL_ROUTES.map(([a, b, length, color]) => ({
      a,
      b,
      length,
      color,
      owner: -1
    }));
    s.players.forEach((p, i) => {
      p.resources = [2, 2, 2];
      p.contracts = [
        [i, i + 8],
        [3 - i, 11 - i]
      ].map(([a, b]) => ({ a, b, done: false }));
    });
  } else if (gameId === 'gemsyndicate') {
    s.bank = [12, 12, 12];
    s.deck = shuffle(
      s,
      range(36).map((i) => ({
        id: i,
        name:
          ['Workshop', 'Guild', 'Palace'][Math.floor(i / 12)] +
          ' ' +
          ((i % 12) + 1),
        color: i % 3,
        points: Math.floor(i / 12) * 2 + (i % 4 === 0 ? 1 : 0),
        cost: range(3).map((c) =>
          Math.max(
            0,
            1 + Math.floor(i / 12) * 2 + ((i + c) % 3) - (c === i % 3 ? 1 : 0)
          )
        )
      }))
    );
    s.market = s.deck.splice(0, 6);
  }
  log(s, `${getTabletopGame(gameId).name}: ${s.players[0].name} starts.`);
  return s;
}
function refillMosaic(s) {
  s.factories = range(s.players.length + 1).map(() =>
    range(4).map(() => random(s, 5))
  );
  s.center = [];
  s.centerTaken = false;
}
export function scores(s) {
  return s.players.map((p, i) =>
    s.gameId === 'oligarchs'
      ? p.out
        ? -1
        : p.cash +
          s.board
            .filter((c) => c.owner === i)
            .reduce((v, c) => v + c.price + c.level * 80, 0)
      : p.score
  );
}
export function finishGame(s, reason = 'game_complete') {
  if (s.done) return;
  s.done = true;
  s.phase = 'finished';
  s.reason = reason;
  const values = scores(s);
  const eligible = s.players.map((p, i) => (p.out ? -Infinity : values[i]));
  const best = Math.max(...eligible);
  const winners = s.players.filter((p, i) => !p.out && eligible[i] === best);
  s.winnerAccountId = winners.length === 1 ? winners[0].id : '';
  log(s, winners.length === 1 ? `${winners[0].name} wins.` : 'Draw.');
}
function nextTurn(s) {
  s.auction = null;
  s.built = false;
  s.turn = (s.turn + 1) % s.players.length;
  if (s.turn === 0) s.round++;
  let guard = 0;
  while (s.players[s.turn].out && guard++ < s.players.length) {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) s.round++;
  }
  if (
    s.players.filter((p) => !p.out).length <= 1 ||
    s.round > getTabletopGame(s.gameId).rounds ||
    (s.finalRound && s.round > s.finalRound)
  )
    finishGame(s);
  else
    s.phase = ['oligarchs', 'harborempires'].includes(s.gameId)
      ? 'roll'
      : 'turn';
}
const action = (id, label, data = {}) => ({ id, label, ...data });
export function legalActions(s) {
  if (s.done) return [];
  const p = activePlayer(s),
    seat = activeSeat(s),
    a = [];
  if (s.auction) {
    if (p.cash >= s.auction.bid + 20)
      a.push(action('bid', `Bid ${s.auction.bid + 20} credits`));
    a.push(action('pass', 'Pass auction'));
    return a;
  }
  if (s.phase === 'roll') return [action('roll', 'Roll dice')];
  if (s.gameId === 'oligarchs') {
    const c = s.board[p.position];
    if (s.phase === 'offer') {
      if (p.cash >= c.price)
        a.push(action('buy', `Buy ${c.name} · ${c.price}`));
      a.push(action('auction', 'Open auction'));
      return a;
    }
    s.board.forEach((c, i) => {
      if (c.owner !== seat) return;
      if (c.level < 3 && p.cash >= 80)
        a.push(action(`develop:${i}`, `Develop ${c.name} · 80`, { cell: i }));
      a.push(
        action(
          `sell:${i}`,
          `Sell ${c.name} · +${Math.floor((c.price + c.level * 80) / 2)}`,
          { cell: i }
        )
      );
    });
    a.push(action('end', 'End turn'));
  } else if (s.gameId === 'harborempires') {
    if (!s.built)
      s.board.forEach((c, i) => {
        if (
          c.owner < 0 &&
          p.resources.every((v) => v >= 1) &&
          neighbors(i).some((j) => s.board[j].owner === seat)
        )
          a.push(
            action(`build:${i}`, `Build ${c.name} · 1 of each`, { cell: i })
          );
        if (
          c.owner === seat &&
          c.level === 1 &&
          p.resources[1] >= 2 &&
          p.resources[2] >= 2
        )
          a.push(
            action(`upgrade:${i}`, `Upgrade ${c.name} · 2 brick + 2 grain`, {
              cell: i
            })
          );
      });
    range(3).forEach((from) =>
      range(3).forEach((to) => {
        if (from !== to && p.resources[from] >= 3)
          a.push(
            action(
              `trade:${from}:${to}`,
              `3 ${RESOURCE_NAMES[from]} → 1 ${RESOURCE_NAMES[to]}`
            )
          );
      })
    );
    a.push(action('end', 'End turn'));
  } else if (s.gameId === 'mosaicroyal') {
    [...s.factories, s.center].forEach((tiles, source) =>
      [...new Set(tiles)].forEach((color) => {
        range(5).forEach((row) => {
          const line = p.rows[row];
          if (
            line.count < row + 1 &&
            (line.color === -1 || line.color === color) &&
            !p.wall[row][(color + row) % 5]
          )
            a.push(
              action(
                `draft:${source}:${color}:${row}`,
                `${source === s.factories.length ? 'Center' : `Tray ${source + 1}`} · color ${color + 1} → row ${row + 1}`,
                { source, color, row }
              )
            );
        });
        a.push(
          action(
            `draft:${source}:${color}:5`,
            `${source === s.factories.length ? 'Center' : `Tray ${source + 1}`} · color ${color + 1} → discard`,
            { source, color, row: 5 }
          )
        );
      })
    );
  } else if (s.gameId === 'railkingdoms') {
    range(3).forEach((i) =>
      a.push(action(`cargo:${i}`, `Collect 2 ${GEM_NAMES[i]} cargo`))
    );
    s.routes.forEach((r, i) => {
      if (r.owner < 0 && p.resources[r.color] >= r.length)
        a.push(
          action(
            `route:${i}`,
            `${CITY_NAMES[r.a]}—${CITY_NAMES[r.b]} · ${r.length} ${GEM_NAMES[r.color]}`,
            { route: i }
          )
        );
    });
  } else if (s.gameId === 'gemsyndicate') {
    if (sum(p.gems) <= 6) {
      range(3).forEach((i) => {
        if (s.bank[i] >= 4)
          a.push(action(`take:${i}:${i}`, `Take 2 ${GEM_NAMES[i]}`));
        range(3)
          .filter((j) => j > i)
          .forEach((j) => {
            if (s.bank[i] > 0 && s.bank[j] > 0)
              a.push(
                action(
                  `take:${i}:${j}`,
                  `Take ${GEM_NAMES[i]} + ${GEM_NAMES[j]}`
                )
              );
          });
      });
    }
    [...s.market, ...p.reserved].forEach((c) => {
      if (c.cost.every((v, i) => Math.max(0, v - p.bonuses[i]) <= p.gems[i]))
        a.push(
          action(`purchase:${c.id}`, `Buy ${c.name} · ${c.points} prestige`, {
            card: c.id
          })
        );
    });
    if (p.reserved.length < 2)
      s.market.forEach((c) =>
        a.push(action(`reserve:${c.id}`, `Reserve ${c.name}`, { card: c.id }))
      );
    range(3).forEach((i) =>
      range(3).forEach((j) => {
        if (i !== j && p.gems[i] >= 2 && s.bank[j] > 0)
          a.push(
            action(
              `exchange:${i}:${j}`,
              `2 ${GEM_NAMES[i]} → 1 ${GEM_NAMES[j]}`
            )
          );
      })
    );
    if (!a.length) a.push(action('end', 'Pass turn'));
  }
  return a;
}
function pay(s, seat, amount, owner = -1) {
  const p = s.players[seat];
  p.cash -= amount;
  const assets = s.board
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.owner === seat)
    .sort((a, b) => a.price - b.price);
  while (p.cash < 0 && assets.length) {
    const c = assets.shift();
    p.cash += Math.floor((c.price + c.level * 80) / 2);
    s.board[c.i].owner = -1;
    s.board[c.i].level = 0;
    log(s, `${p.name} liquidated ${c.name}.`);
  }
  if (owner >= 0)
    s.players[owner].cash += Math.max(0, amount + Math.min(0, p.cash));
  if (p.cash < 0) {
    p.cash = 0;
    p.out = true;
    s.board.forEach((c) => {
      if (c.owner === seat) {
        c.owner = -1;
        c.level = 0;
      }
    });
    log(s, `${p.name} is bankrupt.`);
  }
}
function auctionAdvance(s) {
  const q = s.auction;
  const bidders = s.players
    .map((p, i) => i)
    .filter((i) => !s.players[i].out && !q.passed.includes(i));
  if ((q.high >= 0 && bidders.length === 1) || bidders.length === 0) {
    if (q.high >= 0) {
      s.board[q.cell].owner = q.high;
      s.players[q.high].cash -= q.bid;
      log(
        s,
        `${s.players[q.high].name} won ${s.board[q.cell].name} for ${q.bid}.`
      );
    }
    s.auction = null;
    s.phase = 'manage';
    if (s.players[s.turn].out) nextTurn(s);
    return;
  }
  do {
    q.seat = (q.seat + 1) % s.players.length;
  } while (
    s.players[q.seat].out ||
    q.passed.includes(q.seat) ||
    q.seat === q.high
  );
}
function mosaicScore(s) {
  for (const p of s.players) {
    p.rows.forEach((line, row) => {
      if (line.count !== row + 1) return;
      const col = (line.color + row) % 5;
      p.wall[row][col] = true;
      let horizontal = 1,
        vertical = 1;
      for (const d of [-1, 1]) {
        for (let c = col + d; c >= 0 && c < 5 && p.wall[row][c]; c += d)
          horizontal++;
        for (let r = row + d; r >= 0 && r < 5 && p.wall[r][col]; r += d)
          vertical++;
      }
      p.score +=
        horizontal === 1 && vertical === 1
          ? 1
          : (horizontal > 1 ? horizontal : 0) + (vertical > 1 ? vertical : 0);
      p.rows[row] = { color: -1, count: 0 };
    });
  }
  s.round++;
  if (s.round > 5) {
    for (const p of s.players) {
      p.score += p.wall.filter((r) => r.every(Boolean)).length * 5;
      range(5).forEach((c) => {
        if (p.wall.every((r) => r[c])) p.score += 7;
      });
    }
    finishGame(s);
  } else refillMosaic(s);
}
function connected(s, seat, a, b) {
  const seen = new Set([a]),
    queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    for (const r of s.routes.filter(
      (r) => r.owner === seat && (r.a === cur || r.b === cur)
    )) {
      const n = r.a === cur ? r.b : r.a;
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.has(b);
}
/** Accept only a current legal action ID. Dice, decks, costs and scores are authoritative. */
export function applyAction(
  state,
  playerId,
  actionId,
  revision = state.revision
) {
  if (state.done) return { ok: false, error: 'match_finished' };
  if (revision !== state.revision)
    return { ok: false, error: 'stale_revision' };
  if (activePlayer(state).id !== String(playerId))
    return { ok: false, error: 'not_your_turn' };
  const selected = legalActions(state).find((a) => a.id === actionId);
  if (!selected) return { ok: false, error: 'illegal_action' };
  const s = clone(state),
    p = activePlayer(s),
    seat = activeSeat(s);
  const [type, aa, bb, cc] = actionId.split(':'),
    i = Number(aa),
    j = Number(bb),
    k = Number(cc);
  s.revision++;
  log(s, `${p.name}: ${selected.label}.`);
  if (s.auction) {
    if (type === 'bid') {
      s.auction.bid += 20;
      s.auction.high = seat;
    } else s.auction.passed.push(seat);
    auctionAdvance(s);
    return { ok: true, state: s };
  }
  if (s.gameId === 'oligarchs') {
    if (type === 'roll') {
      s.dice = [random(s, 6) + 1, random(s, 6) + 1];
      const next = p.position + sum(s.dice);
      if (next >= 24) p.cash += 120;
      p.position = next % 24;
      const c = s.board[p.position];
      s.phase = 'manage';
      if (c.kind === 'property') {
        if (c.owner < 0) s.phase = 'offer';
        else if (c.owner !== seat) {
          const pair = s.board
            .filter((t) => t.kind === 'property' && t.district === c.district)
            .every((t) => t.owner === c.owner);
          pay(
            s,
            seat,
            Math.floor(c.price * 0.2) * (c.level + 1) * (pair ? 2 : 1),
            c.owner
          );
        }
      } else if (c.kind === 'tax') pay(s, seat, 60);
      else if (c.kind === 'grant') p.cash += 80;
      else if (c.kind === 'event') {
        const value = [-40, 30, 50, 80][random(s, 4)];
        if (value < 0) pay(s, seat, -value);
        else p.cash += value;
        log(s, `Opportunity: ${value > 0 ? '+' : ''}${value} credits.`);
      }
      if (p.out) nextTurn(s);
    } else if (type === 'buy') {
      p.cash -= s.board[p.position].price;
      s.board[p.position].owner = seat;
      s.phase = 'manage';
    } else if (type === 'auction') {
      s.auction = { cell: p.position, seat, bid: 0, high: -1, passed: [] };
      s.phase = 'auction';
    } else if (type === 'develop') {
      p.cash -= 80;
      s.board[i].level++;
    } else if (type === 'sell') {
      p.cash += Math.floor((s.board[i].price + s.board[i].level * 80) / 2);
      s.board[i].owner = -1;
      s.board[i].level = 0;
    } else nextTurn(s);
  } else if (s.gameId === 'harborempires') {
    if (type === 'roll') {
      s.dice = [random(s, 6) + 1];
      s.board.forEach((c) => {
        if (c.owner >= 0 && c.number === s.dice[0] && !s.players[c.owner].out)
          s.players[c.owner].resources[c.resource] += c.level;
      });
      if (s.dice[0] === 1) p.resources[random(s, 3)]++;
      s.phase = 'build';
    } else if (type === 'trade') {
      p.resources[i] -= 3;
      p.resources[j]++;
    } else if (type === 'build') {
      p.resources = p.resources.map((v) => v - 1);
      s.board[i].owner = seat;
      s.board[i].level = 1;
      p.score++;
      s.built = true;
    } else if (type === 'upgrade') {
      p.resources[1] -= 2;
      p.resources[2] -= 2;
      s.board[i].level = 2;
      p.score += 2;
      s.built = true;
    } else nextTurn(s);
    if (p.score >= 12 && !s.finalRound) s.finalRound = s.round;
  } else if (s.gameId === 'mosaicroyal') {
    const from = i === s.factories.length ? s.center : s.factories[i],
      count = from.filter((c) => c === j).length;
    if (i === s.factories.length) {
      s.center = s.center.filter((c) => c !== j);
      if (!s.centerTaken) {
        p.score = Math.max(0, p.score - 1);
        s.centerTaken = true;
      }
    } else {
      s.center.push(...from.filter((c) => c !== j));
      s.factories[i] = [];
    }
    let excess = count;
    if (k < 5) {
      const line = p.rows[k],
        used = Math.min(count, k + 1 - line.count);
      line.color = j;
      line.count += used;
      excess -= used;
    }
    p.score = Math.max(0, p.score - excess);
    s.turn = (s.turn + 1) % s.players.length;
    while (s.players[s.turn].out) s.turn = (s.turn + 1) % s.players.length;
    if (s.factories.every((f) => f.length === 0) && s.center.length === 0)
      mosaicScore(s);
  } else if (s.gameId === 'railkingdoms') {
    if (type === 'cargo') p.resources[i] += 2;
    else {
      const r = s.routes[i];
      p.resources[r.color] -= r.length;
      r.owner = seat;
      p.score += r.length * r.length;
      p.contracts.forEach((c) => {
        if (!c.done && connected(s, seat, c.a, c.b)) {
          c.done = true;
          p.score += 6;
        }
      });
    }
    if (s.routes.every((r) => r.owner >= 0)) finishGame(s);
    else nextTurn(s);
  } else {
    if (type === 'take') {
      p.gems[i]++;
      p.gems[j]++;
      s.bank[i]--;
      s.bank[j]--;
    } else if (type === 'exchange') {
      p.gems[i] -= 2;
      s.bank[i] += 2;
      p.gems[j]++;
      s.bank[j]--;
    } else if (type === 'purchase' || type === 'reserve') {
      let source = s.market,
        index = source.findIndex((c) => c.id === i);
      if (index < 0) {
        source = p.reserved;
        index = source.findIndex((c) => c.id === i);
      }
      const [card] = source.splice(index, 1);
      if (type === 'purchase') {
        card.cost.forEach((v, c) => {
          const amount = Math.max(0, v - p.bonuses[c]);
          p.gems[c] -= amount;
          s.bank[c] += amount;
        });
        p.bonuses[card.color]++;
        p.score += card.points;
      } else p.reserved.push(card);
      if (source === s.market && s.deck.length) s.market.push(s.deck.shift());
    }
    if (p.score >= 15 && !s.finalRound) s.finalRound = s.round;
    nextTurn(s);
  }
  return { ok: true, state: s };
}
export function forfeitPlayer(state, id) {
  const s = clone(state),
    seat = s.players.findIndex((p) => p.id === id);
  if (seat < 0 || s.done) return s;
  s.players[seat].out = true;
  if (s.gameId === 'oligarchs')
    s.board.forEach((c) => {
      if (c.owner === seat) {
        c.owner = -1;
        c.level = 0;
      }
    });
  s.revision++;
  log(s, `${s.players[seat].name} left the match.`);
  if (s.players.filter((p) => !p.out).length <= 1) {
    finishGame(s, 'opponents_left');
    return s;
  }
  if (s.auction) {
    if (s.auction.high === seat) {
      s.auction.high = -1;
      s.auction.bid = 0;
    }
    if (!s.auction.passed.includes(seat)) s.auction.passed.push(seat);
    if (s.auction.seat === seat) auctionAdvance(s);
  }
  if (s.players[s.turn].out && !s.auction) nextTurn(s);
  return s;
}
export function chooseAiAction(s, difficulty = 'club') {
  const actions = legalActions(s);
  if (!actions.length) return null;
  const p = activePlayer(s);
  if (difficulty === 'casual')
    return (
      actions.find((a) => !a.id.startsWith('sell:') && !a.id.endsWith(':5'))
        ?.id || actions[0].id
    );
  const rank = (a) => {
    const [t, aa, bb, cc] = a.id.split(':'),
      i = Number(aa);
    if (t === 'roll') return 1000;
    if (t === 'buy') return 100;
    if (t === 'bid')
      return p.cash > s.auction.bid + 100 &&
        s.auction.bid < s.board[s.auction.cell].price * 0.9
        ? 100
        : -20;
    if (t === 'pass') return 0;
    if (t === 'develop') return p.cash > 240 ? 30 : -10;
    if (t === 'sell') return -100;
    if (t === 'end') return -5;
    if (t === 'build') return 40;
    if (t === 'upgrade') return 50;
    if (t === 'trade') {
      const to = Number(bb);
      return p.resources[to] === 0 ? 5 : -10;
    }
    if (t === 'draft') {
      const row = Number(cc),
        color = Number(bb),
        source = i === s.factories.length ? s.center : s.factories[i],
        count = source.filter((c) => c === color).length;
      if (row === 5) return -count - 20;
      const need = row + 1 - p.rows[row].count;
      return 12 - Math.abs(need - count) * 3 + (p.rows[row].count ? 3 : 0);
    }
    if (t === 'route') {
      const r = s.routes[i];
      return (
        r.length * r.length +
        10 +
        p.contracts.filter((c) => !c.done && (c.a === r.a || c.b === r.b))
          .length *
          2
      );
    }
    if (t === 'cargo') return 5 - p.resources[i];
    if (t === 'purchase') {
      const c = [...s.market, ...p.reserved].find((c) => c.id === i);
      return 20 + c.points * 5 - p.bonuses[c.color];
    }
    if (t === 'reserve') return -5;
    if (t === 'exchange') return p.gems[Number(bb)] < 2 ? 1 : -6;
    if (t === 'take') {
      const j = Number(bb);
      const need = range(3).map((c) =>
        Math.max(
          ...[...s.market, ...p.reserved].map((card) =>
            Math.max(0, card.cost[c] - p.bonuses[c] - p.gems[c])
          ),
          0
        )
      );
      return 2 + need[i] + need[j];
    }
    return 0;
  };
  return actions.reduce(
    (best, a) => (rank(a) > rank(best) ? a : best),
    actions[0]
  ).id;
}
/** Never serialize the random seed or unrevealed deck to a client. */
export function publicGame(s, viewerId) {
  const { rng, entropy, deck, ...view } = clone(s);
  return {
    ...view,
    deckCount: deck?.length,
    values: scores(s),
    actions: activePlayer(s)?.id === viewerId ? legalActions(s) : []
  };
}

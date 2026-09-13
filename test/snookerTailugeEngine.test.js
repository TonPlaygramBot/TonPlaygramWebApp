import * as THREE from '../webapp/node_modules/three/build/three.cjs';
const {
  TailugePhysics,
  TailugeSnookerRules,
  tailugePockets,
  mapTailugeTableVertex
} = require('./loadTailugeEngine.cjs');
const size = { width: 1.778, length: 3.569, radius: 0.03275 };
const rules = new TailugeSnookerRules();
const hit = (color) => ({ type: 'HIT', firstContact: color });
const pot = (color, ballId = color) => ({
  type: 'POTTED',
  ball: color,
  ballId,
  pocket: 'TL'
});
function view(id, x = 0, y = 0) {
  return {
    id,
    active: true,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    mesh: new THREE.Mesh()
  };
}
function rackState(allowed, a = 0, b = 0) {
  const state = rules.getInitialFrame('A', 'B');
  state.balls.forEach((ball) => {
    ball.onTable = allowed.includes(ball.color) || ball.color === 'CUE';
    ball.potted = !ball.onTable;
  });
  state.redsRemaining = state.balls.filter(
    (b) => b.color === 'RED' && b.onTable
  ).length;
  state.phase = state.redsRemaining ? 'REDS_AND_COLORS' : 'COLORS_ORDER';
  state.players.A.score = a;
  state.players.B.score = b;
  return state;
}
function play(engine, max = 6000) {
  const events = [];
  for (let i = 0; i < max && !engine.allStationary(); i++)
    events.push(...engine.step(1 / 120));
  expect(engine.allStationary()).toBe(true);
  expect(
    engine.table.balls.every((b) =>
      [...b.pos.toArray(), ...b.vel.toArray()].every(Number.isFinite)
    )
  ).toBe(true);
  return events;
}
test('the real solver transfers cue energy to an object ball and settles', () => {
  const cue = view('cue'),
    red = view('red_1', 0, 0.3);
  const engine = new TailugePhysics(size, [red, cue]);
  engine.strike({ x: 0, y: 1 }, 0.25);
  const events = play(engine);
  expect(events.find((e) => e.type === 'Collision')).toMatchObject({
    ball: { id: 'cue' },
    other: { id: 'red_1' }
  });
  expect(red.pos.y).toBeGreaterThan(0.3);
});
test('an in-off is emitted once by the engine and awards ball in hand', () => {
  const pocket = tailugePockets(size)[4];
  const cue = view('cue', pocket.pos.x + 0.3, 0);
  const engine = new TailugePhysics(size, [cue]);
  engine.strike({ x: -1, y: 0 }, 0.2);
  const events = play(engine).filter((e) => e.type === 'Pot');
  expect(events).toHaveLength(1);
  expect(events[0].pocket).toBe('TM');
  const next = rules.applyShot(rules.getInitialFrame('A', 'B'), [pot('CUE')]);
  expect(next).toMatchObject({
    activePlayer: 'B',
    players: { B: { score: 4 } },
    meta: { state: { ballInHand: true } }
  });
});
test('a real red pot drives the next colour turn', () => {
  const p = tailugePockets(size)[4];
  const cue = view('cue', p.pos.x + 0.55, 0),
    red = view('red_1', p.pos.x + 0.25, 0);
  const engine = new TailugePhysics(size, [cue, red]);
  engine.strike({ x: -1, y: 0 }, 0.2, { x: 0, y: -0.6 });
  const events = play(engine);
  expect(
    events.filter((e) => e.type === 'Pot').some((e) => e.ball.id === 'red_1')
  ).toBe(true);
  const shot = [];
  let contacted = false;
  for (const event of events) {
    if (event.type === 'Collision' && !contacted) {
      shot.push(hit('RED'));
      contacted = true;
    }
    if (event.type === 'Pot')
      shot.push(pot(event.ball.id === 'cue' ? 'CUE' : 'RED', event.ball.id));
  }
  const next = rules.applyShot(rules.getInitialFrame('A', 'B'), shot);
  expect(next.foul).toBeUndefined();
  expect(next.players.A.score).toBe(1);
  expect(next.colorOnAfterRed).toBe(true);
});
test('the cushion reflects the ball instead of allowing escape', () => {
  const cue = view('cue', 0, 0.6),
    engine = new TailugePhysics(size, [cue]);
  engine.strike({ x: 1, y: 0 }, 0.35);
  const events = play(engine);
  expect(events.some((e) => e.type === 'Cushion')).toBe(true);
  expect(cue.active).toBe(true);
  expect(Math.abs(cue.pos.x)).toBeLessThan(size.width / 2);
});
test('spin affects the shot, and a second engine cannot renumber the first frame', () => {
  const outcomes = [-1, 0, 1].map((y) => {
    const cue = view('cue');
    const engine = new TailugePhysics(size, [cue]);
    engine.strike({ x: 0, y: 1 }, 0.04, { x: 0, y });
    play(engine);
    return cue.pos.y;
  });
  expect(outcomes[2]).toBeGreaterThan(outcomes[1]);
  expect(outcomes[1]).toBeGreaterThan(outcomes[0]);
  const a = new TailugePhysics(size, [
    view('cue'),
    view('yellow'),
    view('red_1')
  ]);
  const b = new TailugePhysics(size, [view('cue'), view('red_1')]);
  expect(a.table.cueball.id).toBe(0);
  expect(b.table.cueball.id).toBe(0);
});
test('respot avoids an occupied own spot and takes the highest available colour spot', () => {
  const cue = view('cue', 0.5, 0.5),
    yellow = view('yellow'),
    red = view('red_1');
  yellow.active = false;
  const engine = new TailugePhysics(size, [cue, yellow, red]);
  engine.respot(yellow, {
    yellow: [0, 0],
    black: [0, 1],
    pink: [0, 0.7],
    blue: [0, 0.2],
    brown: [0, -0.2],
    green: [0.2, -0.2]
  });
  expect(yellow.active).toBe(true);
  expect(yellow.pos.y).toBe(1);
  expect(yellow.pos.distanceTo(red.pos)).toBeGreaterThan(size.radius * 2);
});
test('alternates red/colour, counts multiple reds and respots colours', () => {
  const initial = rules.getInitialFrame('A', 'B');
  const red = rules.applyShot(initial, [
    hit('RED'),
    pot('RED', 'RED_1'),
    pot('RED', 'RED_2')
  ]);
  const black = rules.applyShot(red, [hit('BLACK'), pot('BLACK')]);
  expect(initial.players.A.score).toBe(0);
  expect(black.players.A.score).toBe(9);
  expect(black.redsRemaining).toBe(13);
  expect(black.ballOn).toEqual(['RED']);
  expect(black.balls.find((b) => b.color === 'BLACK').onTable).toBe(true);
});
test('no contact after a red is a four point foul without a nomination', () => {
  const red = rules.applyShot(rules.getInitialFrame('A', 'B'), [
    hit('RED'),
    pot('RED')
  ]);
  const next = rules.applyShot(red, []);
  expect(next.foul.points).toBe(4);
  expect(next.activePlayer).toBe('B');
});
test('nominated black increases no-contact penalty to seven', () => {
  const state = rules.getInitialFrame('A', 'B');
  state.colorOnAfterRed = true;
  expect(
    rules.applyShot(state, [], { nominatedBall: 'BLACK' }).foul.points
  ).toBe(7);
});
test('yellow must be contacted and potted before green, using pre-shot colour order', () => {
  const state = rackState([
    'YELLOW',
    'GREEN',
    'BROWN',
    'BLUE',
    'PINK',
    'BLACK'
  ]);
  const next = rules.applyShot(state, [hit('YELLOW'), pot('YELLOW')]);
  expect(next.foul).toBeUndefined();
  expect(next.players.A.score).toBe(2);
  expect(next.ballOn).toEqual(['GREEN']);
  const foul = rules.applyShot(state, [hit('GREEN'), pot('GREEN')]);
  expect(foul.foul.points).toBe(4);
  expect(foul.balls.find((b) => b.color === 'GREEN').onTable).toBe(true);
});
test('last red grants one respotted colour before the ordered clearance', () => {
  const state = rules.getInitialFrame('A', 'B');
  state.balls
    .filter((b) => b.color === 'RED')
    .slice(1)
    .forEach((b) => {
      b.onTable = false;
      b.potted = true;
    });
  state.redsRemaining = 1;
  const red = rules.applyShot(state, [hit('RED'), pot('RED', 'RED_1')]);
  expect(red.redsRemaining).toBe(0);
  expect(red.colorOnAfterRed).toBe(true);
  const black = rules.applyShot(red, [hit('BLACK'), pot('BLACK')]);
  expect(black.ballOn).toEqual(['YELLOW']);
  expect(black.balls.find((b) => b.color === 'BLACK').onTable).toBe(true);
});
test('a tied final black is respotted; the next foul decides the frame', () => {
  const next = rules.applyShot(
    rackState(['BLACK'], 10, 17),
    [hit('BLACK'), pot('BLACK')],
    { respottedBlackStarter: 'B' }
  );
  expect(next.frameOver).toBe(false);
  expect(next.meta.state.ballInHand).toBe(true);
  expect(next.activePlayer).toBe('B');
  const end = rules.applyShot(next, []);
  expect(end.frameOver).toBe(true);
  expect(end.winner).toBe('A');
  expect(rules.applyShot(end, [])).toBe(end);
});
test('foul on a colour respots it but removes any reds potted in the same shot', () => {
  const next = rules.applyShot(rules.getInitialFrame('A', 'B'), [
    hit('RED'),
    pot('RED', 'RED_4'),
    pot('BLACK')
  ]);
  expect(next.players.B.score).toBe(7);
  expect(next.redsRemaining).toBe(14);
  expect(next.balls.find((b) => b.id === 'RED_4').onTable).toBe(false);
  expect(next.balls.find((b) => b.color === 'BLACK').onTable).toBe(true);
});
test('table transform preserves the round pocket scale and puts cloth under ball centres', () => {
  const p = mapTailugeTableVertex(new THREE.Vector3(22, 11, -0.5), size, 0.8);
  expect(p.x).toBeCloseTo(size.width / 2);
  expect(p.z).toBeCloseTo(size.length / 2);
  expect(p.y).toBeCloseTo(0.8 - size.radius);
  const q = mapTailugeTableVertex(new THREE.Vector3(22.5, 11, -0.5), size, 0.8);
  expect(q.distanceTo(p)).toBeCloseTo(size.radius);
});
test('a full 22-ball break at maximum power stays finite and settles', () => {
  const r = size.radius,
    balls = [view('cue', -0.2, -1)];
  for (const [id, x, y] of [
    ['yellow', -0.3, -1],
    ['green', 0.3, -1],
    ['brown', 0, -1],
    ['blue', 0, 0],
    ['pink', 0, 0.8],
    ['black', 0, 1.46]
  ])
    balls.push(view(id, x, y));
  let id = 1;
  for (let row = 0; row < 5; row++)
    for (let col = 0; col <= row; col++)
      balls.push(
        view(
          `red_${id++}`,
          (col - row / 2) * r * 2.04,
          0.8 + 2.04 * r + row * Math.sqrt(3) * r * 1.02
        )
      );
  const engine = new TailugePhysics(size, balls);
  engine.strike({ x: 0.22, y: 1 }, 1);
  expect(play(engine).some((e) => e.type === 'Collision')).toBe(true);
});
test('a complete 147 break clears the frame through the imported rules adapter', () => {
  let state = rules.getInitialFrame('A', 'B');
  for (let i = 1; i <= 15; i++) {
    state = rules.applyShot(state, [hit('RED'), pot('RED', `RED_${i}`)]);
    state = rules.applyShot(JSON.parse(JSON.stringify(state)), [
      hit('BLACK'),
      pot('BLACK')
    ]);
    expect(state.foul).toBeUndefined();
  }
  for (const c of ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'])
    state = rules.applyShot(state, [hit(c), pot(c)]);
  expect(state).toMatchObject({
    frameOver: true,
    winner: 'A',
    players: { A: { score: 147, highestBreak: 147 } }
  });
});
test('duplicate pot events score only once and nominated colours enforce first contact', () => {
  const red = rules.applyShot(rules.getInitialFrame('A', 'B'), [
    hit('RED'),
    pot('RED', 'RED_1'),
    pot('RED', 'RED_1')
  ]);
  expect(red.players.A.score).toBe(1);
  const foul = rules.applyShot(red, [hit('BLUE')], { nominatedBall: 'BLACK' });
  expect(foul.foul.points).toBe(7);
  expect(foul.activePlayer).toBe('B');
});

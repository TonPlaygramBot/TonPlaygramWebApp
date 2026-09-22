import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_STAGES } from '../webapp/src/utils/poolRoyaleCareerProgress.js';
import { checkpointPoolFrame, completePoolFrame, createPoolCompetition, loadPoolCompetition, poolCompetitionKey, poolFrameId, poolRaceTo, savePoolCompetition, validPoolCompetition } from '../webapp/src/games/pool/competition.js';

const frame = (winner = 'A') => ({ frameOver: true, winner, players: { A: { score: 7 }, B: { score: 0 } } });
const memory = () => { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test('a pool match requires a series, advances only on match victory and ignores repeated results', () => {
  const initial = createPoolCompetition({ id: 't1' });
  const id = poolFrameId(initial);
  const next = completePoolFrame(initial, id, frame());
  assert.deepEqual(initial.frames, [0, 0]);
  assert.deepEqual(next.frames, [1, 0]);
  assert.equal(next.round, 0);
  assert.equal(completePoolFrame(next, id, frame()), next);
  const advanced = completePoolFrame(next, poolFrameId(next), frame());
  assert.equal(advanced.round, 1);
  assert.deepEqual(advanced.frames, [0, 0]);
  assert.equal(advanced.draw[0].every((pair) => pair.winner && pair.score), true);
  assert.equal(validPoolCompetition(advanced), true);
});

for (const players of [8, 16, 32]) {
  test(`${players}-player draw plays every round and persists only one champion`, () => {
    let event = createPoolCompetition({ players, id: `n${players}` });
    let count = 0;
    while (event.status === 'active') {
      event = completePoolFrame(event, poolFrameId(event), frame());
      assert.equal(validPoolCompetition(event), true);
      assert.ok(++count < 30);
    }
    assert.equal(event.status, 'champion');
    assert.equal(event.champion, 'you');
    assert.equal(event.matchesWon, Math.log2(players));
    assert.equal(event.framesPlayed, Math.log2(players) * 2 + 1);
    assert.equal(event.draw.at(-1)[0].winner, 'you');
    assert.equal(event.draw.flat().every((pair) => pair.winner), true);
    assert.equal(completePoolFrame(event, 'anything', frame()), event);
  });
}

test('losing a rack keeps a series alive, losing a match eliminates and completes the draw', () => {
  let event = createPoolCompetition({ id: 'loss' });
  event = completePoolFrame(event, poolFrameId(event), frame('B'));
  assert.equal(event.status, 'active');
  assert.deepEqual(event.frames, [0, 1]);
  event = completePoolFrame(event, poolFrameId(event), frame('B'));
  assert.equal(event.status, 'eliminated');
  assert.notEqual(event.champion, 'you');
  assert.equal(event.matchesWon, 0);
  assert.equal(event.draw.length, 3);
  assert.equal(validPoolCompetition(event), true);
});

test('every career match format is executable and training stays separate', () => {
  for (const [type, target] of [['friendly', 2], ['league', 3], ['showdown', 5]]) {
    const stage = CAREER_STAGES.find((entry) => entry.type === type);
    let event = createPoolCompetition({ stageId: stage.id, id: type });
    assert.equal(poolRaceTo(event), target);
    assert.equal(event.entrants.length, 2);
    for (let rack = 0; rack < target; rack++) event = completePoolFrame(event, poolFrameId(event), frame());
    assert.equal(event.status, 'champion');
    assert.equal(event.stageId, stage.id);
    assert.equal(validPoolCompetition(event), true);
  }
  assert.throws(() => createPoolCompetition({ stageId: CAREER_STAGES[0].id }));
  assert.throws(() => createPoolCompetition({ stageId: 'unknown' }));
});

test('checkpoint save and reload preserve layout; stale checkpoint cannot undo a result', () => {
  const storage = memory();
  const event = createPoolCompetition({ id: 'resume' });
  const id = poolFrameId(event);
  const layout = [{ id: 'cue', pos: { x: 2, y: 5 }, active: true }];
  const liveFrame = { ...frame(), frameOver: false };
  const saved = checkpointPoolFrame(event, id, liveFrame, layout);
  assert.equal(savePoolCompetition('key', saved, storage), true);
  const restored = loadPoolCompetition('key', storage);
  assert.deepEqual(restored.checkpoint, { frame: liveFrame, layout });
  const next = completePoolFrame(restored, id, frame());
  assert.equal(next.checkpoint, undefined);
  assert.equal(checkpointPoolFrame(next, id, liveFrame, layout), next);
  assert.equal(checkpointPoolFrame(next, poolFrameId(next), frame(), layout), next);
});

test('malformed saves fail safely and account/rules/event storage keys stay isolated', () => {
  const event = createPoolCompetition({ id: 'safe' });
  const bad = structuredClone(event);
  bad.draw[0][0] = { a: 'you', b: 'not-in-the-draw' };
  assert.equal(validPoolCompetition(bad), false);
  assert.equal(loadPoolCompetition('key', { getItem: () => JSON.stringify(bad) }), null);
  assert.equal(loadPoolCompetition('key', { getItem: () => '{broken' }), null);
  assert.equal(savePoolCompetition('key', event, { setItem() { throw Error('quota'); } }), false);
  assert.notEqual(poolCompetitionKey('a'), poolCompetitionKey('b'));
  assert.notEqual(poolCompetitionKey('a', '', '9ball'), poolCompetitionKey('a', '', 'american'));
  assert.notEqual(poolCompetitionKey('a', 'career-stage-007'), poolCompetitionKey('a'));
});

test('all simulated bracket results are stable across reloads', () => {
  let a = createPoolCompetition({ id: 'deterministic', players: 32 });
  let b = JSON.parse(JSON.stringify(a));
  while (a.status === 'active') {
    a = completePoolFrame(a, poolFrameId(a), frame());
    b = completePoolFrame(b, poolFrameId(b), frame());
    assert.deepEqual(a.draw, b.draw);
  }
});

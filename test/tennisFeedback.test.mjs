import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createMatch } from '../shared/tennis/engine.js';

const bundle = await build({
  stdin: {
    contents:
      "export * from './feedback'; export { TennisAudio } from './audio';",
    resolveDir: fileURLToPath(
      new URL('../webapp/src/games/tennis', import.meta.url)
    )
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
});
const { scoreMoment, courtCue, collectStats, freshStats, TennisAudio } =
  await import(
    'data:text/javascript;base64,' +
      Buffer.from(bundle.outputFiles[0].text).toString('base64')
  );

test('score guidance follows deuce, break, set and match points without mutating the match', () => {
  const state = createMatch({ gamesToWin: 6, setsToWin: 2 });
  state.score.points = [3, 3];
  assert.equal(scoreMoment(state, 0), 'Deuce · win two in a row');
  state.score.points = [2, 3];
  assert.equal(scoreMoment(state, 0), 'Opponent break point');
  assert.equal(scoreMoment(state, 1), 'Your break point');
  state.score.points = [3, 1];
  state.score.games = [5, 2];
  assert.equal(scoreMoment(state, 0), 'Your set point');
  state.score.sets = [1, 0];
  const before = structuredClone(state);
  assert.equal(scoreMoment(state, 0), 'Your match point');
  assert.deepEqual(state, before);
});

test('tie-break and one-game match points use the actual match format', () => {
  const state = createMatch();
  state.score.points = [3, 1];
  assert.equal(scoreMoment(state, 0), 'Your match point');
  state.score.tie = true;
  state.score.games = [3, 3];
  state.score.points = [5, 6];
  assert.equal(scoreMoment(state, 0), 'Opponent match point');
  state.score.points = [6, 6];
  assert.equal(scoreMoment(state, 0), '');
  state.phase = 'over';
  assert.equal(scoreMoment(state, 0), '');
});

test('live coaching distinguishes the receiving seat and an actually queued stroke', () => {
  const state = createMatch();
  assert.match(courtCue(state, 0, true), /Tap to serve/);
  assert.match(courtCue(state, 1, true), /Watch the serve/);
  state.phase = 'fault';
  state.fault = 1;
  assert.match(courtCue(state, 1, true), /Opponent/);
  state.phase = 'rally';
  state.time = 2;
  state.ball.last = 1;
  assert.match(courtCue(state, 0, true), /Ball incoming/);
  state.players[0].queued = 2.5;
  assert.match(courtCue(state, 0, true), /Shot queued/);
  state.time = 3;
  state.ball.last = 0;
  assert.match(courtCue(state, 0, false), /Drag to recover/);
});

test('repeated network snapshots do not double-count shots or the match-winning point', () => {
  const state = createMatch();
  state.events = [
    { id: 1, type: 'serve', seat: 0, label: '' },
    { id: 2, type: 'hit', seat: 1, label: '' },
    { id: 3, type: 'point', seat: 1, label: '' },
    { id: 4, type: 'win', seat: 0, label: '' }
  ];
  const stats = freshStats();
  collectStats(stats, state);
  collectStats(stats, structuredClone(state));
  assert.deepEqual(stats.shots, [1, 1]);
  assert.deepEqual(stats.points, [1, 1]);
  assert.deepEqual(freshStats().points, [0, 0]);
});

test('point audio follows the online seat and mute silences already-playing audio', () => {
  const sound = new TennisAudio();
  const tones = [],
    gainChanges = [];
  sound.tone = (frequency) => tones.push(frequency);
  sound.crowd = () => {};
  sound.seat = 1;
  sound.events([{ id: 1, type: 'point', seat: 1, label: '' }]);
  sound.events([{ id: 1, type: 'point', seat: 1, label: '' }]);
  sound.events([{ id: 2, type: 'point', seat: 0, label: '' }]);
  assert.deepEqual(tones, [660, 330]);
  sound.ctx = { currentTime: 2 };
  sound.gain = {
    gain: { setTargetAtTime: (value) => gainChanges.push(value) }
  };
  sound.enabled = false;
  sound.enabled = true;
  assert.deepEqual(gainChanges, [0, 0.5]);
});

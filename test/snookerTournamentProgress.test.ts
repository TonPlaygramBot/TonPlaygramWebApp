import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import {
  CAREER_STORAGE_KEY,
  TOURNAMENT_STORAGE_KEY,
  createCareer,
  createTournament,
  enterEvent,
  completeCareerFrame,
  frameId,
  loadCareer,
  loadTournament,
  saveCareer,
  saveTournament,
  saveCheckpoint,
  validCareer
} from '../webapp/src/games/snooker/career';

const rules = new SnookerRoyalRules();
const frame = () => rules.getInitialFrame('Player', 'Rival');
const finished = (winner: 'A' | 'B' = 'A') => ({
  ...frame(),
  frameOver: true,
  winner
});
const layout = [{ id: 'cue', active: true, pos: { x: 10, y: 20 } }];
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
};

test('standalone tournament finishes three rounds and leaves the career save untouched', () => {
  const storage = memory();
  const career = enterEvent(createCareer('Artur'));
  saveCareer(career, storage);
  let tournament = enterEvent(createTournament('Artur', 1, 'professional'));
  expect(tournament.match!.bestOf).toBe(1);
  for (let round = 0; round < 3; round++) {
    const id = frameId(tournament);
    tournament = completeCareerFrame(tournament, id, finished());
    expect(completeCareerFrame(tournament, id, finished())).toBe(tournament);
    expect(saveTournament(tournament, storage)).toBe(true);
    tournament = loadTournament(storage);
    expect(validCareer(tournament, true)).toBe(true);
  }
  expect(tournament.lastResult).toMatchObject({
    champion: 'player',
    finish: 'Champion',
    points: 0
  });
  expect(tournament.draw!.flat()).toHaveLength(7);
  expect(
    tournament.draw!.flat().every((pair) => pair.score && pair.winner)
  ).toBe(true);
  expect(enterEvent(tournament)).toBe(tournament);
  expect(loadCareer(storage)).toEqual(career);
  expect(storage.getItem(CAREER_STORAGE_KEY)).not.toBe(
    storage.getItem(TOURNAMENT_STORAGE_KEY)
  );
});

test.each([1, 3, 5, 7, 9])(
  'best of %i honours match thresholds and simulates elimination to a champion',
  (bestOf) => {
    let state = enterEvent(createTournament('Player', bestOf));
    const target = Math.ceil(bestOf / 2);
    for (let i = 0; i < target; i++)
      state = completeCareerFrame(state, frameId(state), finished('B'));
    expect(state.match).toBeUndefined();
    expect(state.framesPlayed).toBe(target);
    expect(state.lastResult!.finish).toBe('Quarter-final');
    expect(state.lastResult!.champion).not.toBe('player');
    expect(validCareer(state, true)).toBe(true);
  }
);

test('new event identity prevents stale frames from a previous tournament changing the new draw', () => {
  const before = enterEvent(createTournament('Player', 1));
  const after = enterEvent(createTournament('Player', 1));
  expect(frameId(before)).not.toBe(frameId(after));
  expect(completeCareerFrame(after, frameId(before), finished())).toBe(after);
});

test('checkpoint revisions reject delayed writes and stale previous-frame checkpoints', () => {
  const state = enterEvent(createCareer());
  const saved = saveCheckpoint(state, frameId(state), frame(), layout, 3);
  const delayed = saveCheckpoint(
    saved,
    frameId(saved),
    frame(),
    [{ ...layout[0], pos: { x: 1, y: 2 } }],
    2
  );
  expect(delayed).toBe(saved);
  const next = completeCareerFrame(saved, frameId(saved), finished());
  expect(saveCheckpoint(next, frameId(saved), frame(), layout, 4)).toBe(next);
  expect(next.match!.checkpoint).toBeUndefined();
});

test.each([
  (state: any) => {
    state.draw[0][1].a = state.draw[0][0].a;
  },
  (state: any) => {
    state.draw[0][0].b = 'unknown';
  },
  (state: any) => {
    state.draw[0][0].winner = 'unknown';
  },
  (state: any) => {
    state.draw[0][0].score = [2, 2];
  },
  (state: any) => {
    state.match.frames = [2, 0];
  },
  (state: any) => {
    state.match.frameNumber = 20;
  },
  (state: any) => {
    state.match.round = 8;
  },
  (state: any) => {
    state.match.bestOf = 19;
  },
  (state: any) => {
    state.framesWon = 10;
  },
  (state: any) => {
    state.draw = [null];
  },
  (state: any) => {
    state.ledger = [null];
  },
  (state: any) => {
    state.completedFrames = [null];
  }
])(
  'invalid saved brackets recover safely without leaking malformed state',
  (corrupt) => {
    const state = enterEvent(createCareer('Corrupt'));
    corrupt(state);
    expect(validCareer(state)).toBe(false);
    const restored = loadCareer({ getItem: () => JSON.stringify(state) });
    expect(restored.name).toBe('Player');
    expect(restored.match).toBeUndefined();
  }
);

test('corrupt shot snapshots restart only the current frame and preserve tournament progress', () => {
  let state = enterEvent(createCareer('Artur'));
  state = completeCareerFrame(state, frameId(state), finished());
  const corrupt = {
    ...state,
    match: {
      ...state.match,
      checkpoint: {
        frame: frame(),
        layout: [{ id: 'cue', active: true, pos: { x: 'bad', y: 0 } }]
      }
    }
  };
  const restored = loadCareer({ getItem: () => JSON.stringify(corrupt) });
  expect(restored.match!.frames).toEqual([1, 0]);
  expect(restored.match!.checkpoint).toBeUndefined();
  expect(restored.name).toBe('Artur');
});

test('invalid terminal frames are ignored without accepting broken scores or ties', () => {
  const state = enterEvent(createCareer());
  const bad = finished();
  bad.players.A.score = Number.NaN;
  expect(completeCareerFrame(state, frameId(state), bad)).toBe(state);
  expect(
    completeCareerFrame(state, frameId(state), { ...finished(), winner: 'TIE' })
  ).toBe(state);
});

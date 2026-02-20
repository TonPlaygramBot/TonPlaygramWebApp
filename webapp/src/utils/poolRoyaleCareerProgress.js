const CAREER_PROGRESS_KEY = 'poolRoyaleCareerProgress';

const stage = (id, config) => ({ id, ...config });

export const CAREER_STAGES = [
  stage(1, {
    lane: 'training',
    title: 'Cue Fundamentals',
    objective: 'Clear the intro drill and control your cue ball speed.',
    trainingLevel: 1,
    rewardTPC: 200
  }),
  stage(2, {
    lane: 'friendly',
    title: 'Club Warmup Match',
    objective: 'Win a friendly AI match to unlock the league table.',
    variant: 'uk',
    rewardTPC: 300
  }),
  stage(3, {
    lane: 'training',
    title: 'Rail Mastery',
    objective: 'Beat a rail-positioning drill to stabilize your patterns.',
    trainingLevel: 6,
    rewardTPC: 350
  }),
  stage(4, {
    lane: 'tournament',
    title: 'Local Cup (4 Players)',
    objective: 'Survive a compact local tournament bracket.',
    players: 4,
    rewardTPC: 500
  }),
  stage(5, {
    lane: 'friendly',
    title: 'American Challenge',
    objective: 'Win an American-style friendly to prove adaptability.',
    variant: 'american',
    rewardTPC: 450
  }),
  stage(6, {
    lane: 'training',
    title: 'Spin Lab',
    objective: 'Complete spin-focused drills and avoid scratch errors.',
    trainingLevel: 12,
    rewardTPC: 500
  }),
  stage(7, {
    lane: 'friendly',
    title: '9-Ball Tempo',
    objective: 'Win a 9-ball style friendly with clean tempo.',
    variant: '9ball',
    rewardTPC: 550
  }),
  stage(8, {
    lane: 'tournament',
    title: 'Regional Open (8 Players)',
    objective: 'Climb an 8-player bracket without dropping focus.',
    players: 8,
    rewardTPC: 800
  }),
  stage(9, {
    lane: 'training',
    title: 'Pressure Routine',
    objective: 'Finish pressure drills with no easy misses.',
    trainingLevel: 18,
    rewardTPC: 700
  }),
  stage(10, {
    lane: 'friendly',
    title: 'Night Arena Friendly',
    objective: 'Beat a tougher AI set under pressure pacing.',
    variant: 'uk',
    rewardTPC: 700
  }),
  stage(11, {
    lane: 'training',
    title: 'Break and Control',
    objective: 'Complete break-control drills and hold position.',
    trainingLevel: 24,
    rewardTPC: 800
  }),
  stage(12, {
    lane: 'tournament',
    title: 'Pro Circuit (16 Players)',
    objective: 'Take down your first full-size bracket.',
    players: 16,
    rewardTPC: 1200
  })
];

export const CAREER_STAGE_COUNT = CAREER_STAGES.length;

const normalizeSet = (values) => {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  values.forEach((value) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) unique.add(Math.floor(parsed));
  });
  return [...unique].sort((a, b) => a - b);
};

export function loadCareerProgress() {
  if (typeof window === 'undefined') {
    return { completed: [], failed: [], lastStage: 1 };
  }
  try {
    const raw = window.localStorage.getItem(CAREER_PROGRESS_KEY);
    if (!raw) return { completed: [], failed: [], lastStage: 1 };
    const parsed = JSON.parse(raw);
    const completed = normalizeSet(parsed?.completed);
    const failed = normalizeSet(parsed?.failed);
    const lastStage = Math.max(
      1,
      Math.min(CAREER_STAGE_COUNT, Number(parsed?.lastStage) || 1)
    );
    return { completed, failed, lastStage };
  } catch (err) {
    console.warn('Failed to load Pool Royale career progress', err);
    return { completed: [], failed: [], lastStage: 1 };
  }
}

export function persistCareerProgress(progress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAREER_PROGRESS_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Failed to persist Pool Royale career progress', err);
  }
}

export function getCareerStage(value) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
  const clamped = Math.max(1, Math.min(CAREER_STAGE_COUNT, safe));
  return (
    CAREER_STAGES.find((entry) => entry.id === clamped) || CAREER_STAGES[0]
  );
}

export function getNextCareerStage(completed) {
  const completedSet = new Set(normalizeSet(completed));
  for (let id = 1; id <= CAREER_STAGE_COUNT; id += 1) {
    if (!completedSet.has(id)) return id;
  }
  return CAREER_STAGE_COUNT;
}

export function markCareerStageResult({ stageId, won }) {
  const safeStage = getCareerStage(stageId).id;
  const previous = loadCareerProgress();
  const completedSet = new Set(normalizeSet(previous.completed));
  const failedSet = new Set(normalizeSet(previous.failed));

  if (won) {
    completedSet.add(safeStage);
    failedSet.delete(safeStage);
  } else {
    failedSet.add(safeStage);
  }

  const completed = [...completedSet].sort((a, b) => a - b);
  const failed = [...failedSet].sort((a, b) => a - b);
  const lastStage = won
    ? getNextCareerStage(completed)
    : Math.max(previous.lastStage || 1, safeStage);
  const updated = { completed, failed, lastStage };
  persistCareerProgress(updated);
  return updated;
}

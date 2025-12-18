const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress';

export const TRAINING_LEVELS = [
  {
    level: 1,
    title: 'Opening break',
    objective: 'Place the cue ball, hit the rack cleanly, and pocket any object ball.',
    reward: 'Unlocks aim assist calibration.'
  },
  {
    level: 2,
    title: 'Position & safety',
    objective: 'Avoid fouls while leaving the cue ball safe for your next shot.',
    reward: 'Ball-in-hand respot practice.'
  },
  {
    level: 3,
    title: 'Run the table',
    objective: 'Sink three balls in one visit without scratching.',
    reward: 'Pro tip overlays for long pots.'
  },
  {
    level: 4,
    title: 'Finishing shot',
    objective: 'Clear the final ball under pressure to close the frame.',
    reward: 'Celebration banners and XP boost.'
  }
];

export function describeTrainingLevel(level) {
  const numeric = Number(level);
  const fallback = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
  const preset = TRAINING_LEVELS.find((entry) => entry.level === fallback);
  if (preset) return preset;
  return {
    level: fallback,
    title: `Level ${fallback}`,
    objective: 'Complete drills to unlock new cues and tips.',
    reward: 'Progress boost'
  };
}

export function loadTrainingProgress() {
  if (typeof window === 'undefined') return { completed: [], lastLevel: 1 };
  try {
    const stored = window.localStorage.getItem(TRAINING_PROGRESS_KEY);
    if (!stored) return { completed: [], lastLevel: 1 };
    const parsed = JSON.parse(stored);
    const completed = Array.isArray(parsed?.completed)
      ? parsed.completed
          .map((lvl) => Number(lvl))
          .filter((lvl) => Number.isFinite(lvl) && lvl > 0)
          .sort((a, b) => a - b)
      : [];
    const lastLevel = Number.isFinite(parsed?.lastLevel) ? Number(parsed.lastLevel) : 1;
    return { completed, lastLevel };
  } catch (err) {
    console.warn('Failed to load Pool Royale training progress', err);
    return { completed: [], lastLevel: 1 };
  }
}

export function persistTrainingProgress(progress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Failed to persist Pool Royale training progress', err);
  }
}

export function getNextIncompleteLevel(completedLevels) {
  const completedSet = new Set((completedLevels || []).map((lvl) => Number(lvl)));
  for (let level = 1; level <= 50; level++) {
    if (!completedSet.has(level)) return level;
  }
  return null;
}

export function resolvePlayableTrainingLevel(requestedLevel, progress) {
  const completed = progress?.completed || [];
  const nextIncomplete = getNextIncompleteLevel(completed);
  const lastLevel = Number.isFinite(progress?.lastLevel) ? progress.lastLevel : 1;
  const desired = Number.isFinite(requestedLevel) && requestedLevel > 0 ? requestedLevel : nextIncomplete || lastLevel || 1;

  // Let players replay any unlocked task while still preventing them from skipping ahead
  // of the current progression. This fixes the flow where selecting a specific task
  // from the lobby could redirect back to the first incomplete level and render a
  // blank screen before the redirect finishes.
  if (nextIncomplete !== null) {
    const cappedDesired = Math.max(1, Math.min(50, Math.floor(desired)));
    if (cappedDesired <= nextIncomplete) {
      return cappedDesired;
    }
    return Math.max(1, Math.min(50, nextIncomplete));
  }

  return Math.max(1, Math.min(desired, lastLevel || 50));
}

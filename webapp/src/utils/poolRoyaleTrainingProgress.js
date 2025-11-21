const TRAINING_PROGRESS_KEY = 'poolRoyaleTrainingProgress';

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
  const unlocked = nextIncomplete === null ? lastLevel || 1 : nextIncomplete;
  const desired = Number.isFinite(requestedLevel) && requestedLevel > 0 ? requestedLevel : unlocked;
  return Math.max(1, Math.min(desired, unlocked));
}

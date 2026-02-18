export type TrainingObjectiveType =
  | 'pot'
  | 'position'
  | 'combo'
  | 'bank'
  | 'kick'
  | 'safety'
  | 'breakout'
  | 'speed-control';

export interface TrainingBallPlacement {
  id: string;
  x: number;
  y: number;
  kind: 'cue' | 'object';
  number?: number;
}

export interface TrainingTask {
  id: string;
  level: number;
  title: string;
  strategyTag: string;
  objective: TrainingObjectiveType;
  requiredPots: number;
  maxShots: number;
  balls: TrainingBallPlacement[];
  hint: string;
}

export interface TrainingProgress {
  mode: 'training';
  currentLevel: number;
  completedLevels: number[];
  carryOverAttempts: number;
  activeAttemptsRemaining: number | null;
  updatedAtIso: string;
}

export interface TrainingRoadmapNode {
  level: number;
  title: string;
  strategyTag: string;
  status: 'locked' | 'current' | 'completed';
}

export interface TrainingModeConfig {
  totalLevels: number;
  includeAiOpponent: false;
  includeDiceRolls: false;
  keepTableLoadedBetweenLevels: true;
  persistProgress: true;
}

const TABLE_MIN = 0.08;
const TABLE_MAX_X = 0.92;
const TABLE_MAX_Y = 0.92;
const DEFAULT_ATTEMPTS_PER_LEVEL = 3;

const STRATEGY_SETS: Array<{
  tag: string;
  titlePrefix: string;
  objective: TrainingObjectiveType;
  hint: string;
  baseBalls: number;
}> = [
  {
    tag: 'stop-shot',
    titlePrefix: 'Stop Shot Control',
    objective: 'position',
    hint: 'Keep cue-ball near the contact line and avoid overrun.',
    baseBalls: 2
  },
  {
    tag: 'stun-follow-draw',
    titlePrefix: 'Stun / Follow / Draw',
    objective: 'position',
    hint: 'Mix vertical cue offsets to control cue-ball path after contact.',
    baseBalls: 2
  },
  {
    tag: 'cut-angle',
    titlePrefix: 'Cut Angle Ladder',
    objective: 'pot',
    hint: 'Visualize ghost-ball contact and trust the line.',
    baseBalls: 3
  },
  {
    tag: 'rail-first',
    titlePrefix: 'Rail-First Recovery',
    objective: 'kick',
    hint: 'Use one-rail contact with controlled speed before object-ball impact.',
    baseBalls: 3
  },
  {
    tag: 'bank-shot',
    titlePrefix: 'Bank Shot Fundamentals',
    objective: 'bank',
    hint: 'Aim mirror point and adjust for speed-induced throw.',
    baseBalls: 3
  },
  {
    tag: 'combination',
    titlePrefix: 'Combination Path',
    objective: 'combo',
    hint: 'Focus on first-ball line; second-ball path should be passive and clean.',
    baseBalls: 4
  },
  {
    tag: 'breakout',
    titlePrefix: 'Cluster Breakout',
    objective: 'breakout',
    hint: 'Open clusters with medium speed while keeping the cue-ball safe.',
    baseBalls: 5
  },
  {
    tag: 'safety',
    titlePrefix: 'Safety Placement',
    objective: 'safety',
    hint: 'Prioritize cue-ball hiding angles over aggressive pocketing.',
    baseBalls: 4
  },
  {
    tag: 'speed-control',
    titlePrefix: 'Speed Control Zones',
    objective: 'speed-control',
    hint: 'Land cue-ball in target zone using minimal rail travel.',
    baseBalls: 3
  },
  {
    tag: 'runout',
    titlePrefix: 'Mini Runout Pattern',
    objective: 'pot',
    hint: 'Plan two balls ahead before every shot.',
    baseBalls: 6
  }
];

export const TRAINING_MODE_CONFIG: TrainingModeConfig = {
  totalLevels: 50,
  includeAiOpponent: false,
  includeDiceRolls: false,
  keepTableLoadedBetweenLevels: true,
  persistProgress: true
};

function clamp01(value: number): number {
  return Math.max(TABLE_MIN, Math.min(value, TABLE_MAX_X));
}

function clampY(value: number): number {
  return Math.max(TABLE_MIN, Math.min(value, TABLE_MAX_Y));
}

function ballPosition(level: number, slot: number): { x: number; y: number } {
  const angle = (level * 0.53 + slot * 1.21) % (Math.PI * 2);
  const radial = 0.12 + ((level + slot) % 5) * 0.06;
  const cx = 0.5 + Math.cos(angle) * radial;
  const cy = 0.5 + Math.sin(angle) * radial * 0.72;
  return { x: clamp01(cx), y: clampY(cy) };
}

function buildTask(level: number): TrainingTask {
  const strategy = STRATEGY_SETS[Math.floor((level - 1) / 5)];
  const stage = (level - 1) % 5;
  const objectCount = Math.min(8, strategy.baseBalls + stage);
  const balls: TrainingBallPlacement[] = [];

  const cue = ballPosition(level, 0);
  balls.push({
    id: `cue_${level}`,
    x: cue.x,
    y: cue.y,
    kind: 'cue'
  });

  for (let i = 0; i < objectCount; i += 1) {
    const pos = ballPosition(level, i + 1);
    balls.push({
      id: `obj_${level}_${i + 1}`,
      x: pos.x,
      y: pos.y,
      kind: 'object',
      number: ((level + i) % 15) + 1
    });
  }

  return {
    id: `training_${level}`,
    level,
    title: `${strategy.titlePrefix} ${stage + 1}`,
    strategyTag: strategy.tag,
    objective: strategy.objective,
    requiredPots: Math.max(1, Math.min(objectCount, stage + 1)),
    maxShots: Math.max(1, 4 + stage),
    balls,
    hint: strategy.hint
  };
}

export const TRAINING_TASKS: TrainingTask[] = Array.from(
  { length: TRAINING_MODE_CONFIG.totalLevels },
  (_, idx) => buildTask(idx + 1)
);

export function createInitialTrainingProgress(nowIso = new Date().toISOString()): TrainingProgress {
  return {
    mode: 'training',
    currentLevel: 1,
    completedLevels: [],
    carryOverAttempts: 0,
    activeAttemptsRemaining: null,
    updatedAtIso: nowIso
  };
}

export function startTrainingLevel(progress: TrainingProgress, nowIso = new Date().toISOString()): TrainingProgress {
  if (progress.activeAttemptsRemaining !== null) {
    return { ...progress, updatedAtIso: nowIso };
  }

  return {
    ...progress,
    activeAttemptsRemaining: DEFAULT_ATTEMPTS_PER_LEVEL + progress.carryOverAttempts,
    updatedAtIso: nowIso
  };
}

export function consumeAttempt(progress: TrainingProgress, nowIso = new Date().toISOString()): TrainingProgress {
  if (progress.activeAttemptsRemaining === null) {
    return startTrainingLevel(progress, nowIso);
  }

  return {
    ...progress,
    activeAttemptsRemaining: Math.max(0, progress.activeAttemptsRemaining - 1),
    updatedAtIso: nowIso
  };
}

export function completeCurrentLevel(progress: TrainingProgress, nowIso = new Date().toISOString()): TrainingProgress {
  const attemptsLeft = progress.activeAttemptsRemaining ?? DEFAULT_ATTEMPTS_PER_LEVEL + progress.carryOverAttempts;
  const currentLevel = progress.currentLevel;
  const nextLevel = Math.min(TRAINING_MODE_CONFIG.totalLevels, currentLevel + 1);

  return {
    ...progress,
    currentLevel: nextLevel,
    completedLevels: Array.from(new Set([...progress.completedLevels, currentLevel])).sort((a, b) => a - b),
    carryOverAttempts: attemptsLeft,
    activeAttemptsRemaining: null,
    updatedAtIso: nowIso
  };
}

export function hasAttemptsRemaining(progress: TrainingProgress): boolean {
  return (progress.activeAttemptsRemaining ?? 0) > 0;
}

export function getCurrentTrainingTask(progress: TrainingProgress): TrainingTask {
  return TRAINING_TASKS[Math.max(0, Math.min(progress.currentLevel - 1, TRAINING_TASKS.length - 1))];
}

export function getTrainingRoadmap(progress: TrainingProgress): TrainingRoadmapNode[] {
  const completed = new Set(progress.completedLevels);
  return TRAINING_TASKS.map((task) => ({
    level: task.level,
    title: task.title,
    strategyTag: task.strategyTag,
    status: completed.has(task.level)
      ? 'completed'
      : task.level === progress.currentLevel
        ? 'current'
        : 'locked'
  }));
}

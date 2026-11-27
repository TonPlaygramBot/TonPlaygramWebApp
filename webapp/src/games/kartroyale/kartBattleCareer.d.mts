export const BATTLE_CAREER_STORAGE_KEY: 'tonplaygram.kartroyale.battle-career.v1';
export type BattleMode = 'boss' | 'race' | 'drift' | 'checkpoint' | 'time' | 'clean';
export type BattleFormat = 'classic' | 'combat-arcade' | 'last-kart-standing' | 'boss'
  | 'police-pursuit-arcade' | 'drift' | 'elimination';
export const BATTLE_FORMATS: Readonly<Record<BattleFormat, Readonly<{ title: string; intervalSeconds?: 30 }>>>;
export type BattleRank = Readonly<{ id: string; title: string; minXp: number }>;
export type BattleMission = Readonly<{
  id: string; crewId: string; courseId: string; title: string; kind: BattleMode; format: BattleFormat;
  prerequisite: string | null; xpAward: number; readiness: 'content-only'; rivalName?: string;
  criteria: Readonly<Partial<{
    maxPlace: number; opponents: number; minDriftPoints: number;
    minCheckpoints: number; maxTimeSeconds: number; maxCollisions: number;
  }>>;
}>;
export type BattleCrew = Readonly<{ id: string; title: string; courseId: string; boss: string; intro: string; style: string; missions: readonly BattleMission[] }>;
export type BattleProgress = { version: 1; completedMissionIds: readonly string[]; xp: number };
export type BattleResult = {
  finished: boolean; courseId: string; format: BattleFormat; place?: number; opponents?: number;
  driftPoints?: number; checkpoints?: number; seconds?: number; collisions?: number; remainingKarts?: number;
  arcadeObjectiveCompleted?: boolean; pursuitCompleted?: boolean; eliminationIntervalSeconds?: number;
};
export type BattleMissionStatus = 'missing' | 'completed' | 'available' | 'locked';
export const BATTLE_CREWS: readonly BattleCrew[];
export const BATTLE_RANKS: readonly BattleRank[];
export function getBattleMission(id: string): BattleMission | undefined;
export function getBattleCareerRank(xp: number): BattleRank;
export function normalizeBattleCareerProgress(input?: unknown): BattleProgress;
export function getBattleMissionStatus(id: string, input?: unknown): BattleMissionStatus;
export function recordBattleCareerResult(input: unknown, id: string, result: BattleResult, verifiedMissionIds?: readonly string[]):
  { progress: BattleProgress; xpAward: number; accepted: boolean };
export function readBattleCareer(storage: Pick<Storage, 'getItem'>): BattleProgress;
export function saveBattleCareer(storage: Pick<Storage, 'setItem'>, progress: unknown): boolean;

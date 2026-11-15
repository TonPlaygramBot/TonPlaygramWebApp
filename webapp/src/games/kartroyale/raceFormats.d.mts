import type { Racer } from './simulation.mjs';
export type RaceFormat = 'race' | 'combat' | 'trial' | 'championship';
export const RACE_FORMATS: readonly RaceFormat[];
export function normalizeRaceFormat(value: unknown): RaceFormat;
export function bestTrialLap(racer: Racer): number;
export function trialStandings(racers: Racer[]): Racer[];

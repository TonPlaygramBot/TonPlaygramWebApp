import type { Result } from './renderer';
export interface StreetLoadout {
  kart: string;
  driver: 'turi' | 'helmet';
  paint: string;
  ammo: 'single' | 'double';
  shield: 'single' | 'double';
}
export interface StreetCareer {
  version: 1;
  completed: Record<string, boolean>;
  best: Record<string, number>;
  tasks: Record<string, string[]>;
  xp: number;
  loadout: StreetLoadout;
}
export interface StreetStage {
  id: string;
  name: string;
  number: number;
  target: number;
  difficulty: string;
  reward: number;
}
export const STREET_CAREER_KEY: string;
export const DRIVER_STYLES: string[];
export const CAREER_PAINTS: string[];
export function careerStages(
  tracks: { id: string; name: string }[]
): StreetStage[];
export function normalizeStreetCareer(
  value: unknown,
  tracks: { id: string }[],
  karts: { id: string }[]
): StreetCareer;
export function loadStreetCareer(
  storage: Storage | undefined,
  tracks: { id: string }[],
  karts: { id: string }[]
): StreetCareer;
export function saveStreetCareer(
  storage: Storage | undefined,
  profile: StreetCareer
): boolean;
export function stageUnlocked(
  profile: StreetCareer,
  stages: StreetStage[],
  id: string
): boolean;
export function finishStreetStage(
  profile: StreetCareer,
  tracks: { id: string; name: string }[],
  karts: { id: string }[],
  id: string,
  result: Result
): { profile: StreetCareer; bonus: number; completed: boolean };
export function careerSupplies(loadout?: { ammo?: string; shield?: string }): {
  rocket: number;
  shield: number;
};
export function equipCareerSupply(
  supplies: { rocket: number; shield: number } | null,
  racer: unknown,
  kind: string
): boolean;

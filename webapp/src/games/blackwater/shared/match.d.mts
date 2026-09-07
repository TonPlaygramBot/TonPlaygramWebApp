import type { Vec2 } from '../core';
import type { OnlinePlayer } from '../online';
export const STEP: number, MATCH_LIMIT: number, KILL_LIMIT: number;
export type MatchInput = {
  seq: number;
  rx: number;
  forward: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  aim: boolean;
  crouch: boolean;
  sprint: boolean;
  reload: boolean;
  heal: boolean;
};
export type MatchPlayer = OnlinePlayer & {
  input: MatchInput;
  cooldown: number;
  lastSeq: number;
  lastInput: number;
};
export type Match = {
  elapsed: number;
  players: MatchPlayer[];
  rng: () => number;
  events: { type: string; by: string; target: string; head: boolean }[];
  winnerAccountId: string;
  done: boolean;
  reason: string;
};
export function idleInput(): MatchInput;
export function sanitizeInput(input: unknown): MatchInput | null;
export function spawnPoint(
  index: number,
  players?: (Vec2 & { hp: number })[]
): Vec2;
export function createPlayer(
  id: string,
  name: string,
  index: number,
  players?: (Vec2 & { hp: number })[]
): MatchPlayer;
export function makeMatch(players: { id: string; name: string }[]): Match;
export function stepMatch(match: Match, dt?: number): void;
export function publicMatch(match: Match): {
  elapsed: number;
  limit: number;
  killLimit: number;
  players: OnlinePlayer[];
  events: Match['events'];
  winnerAccountId: string;
  reason: string;
};

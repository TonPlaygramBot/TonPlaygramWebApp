import type { Racer, Track, Input } from './simulation.mjs';
export const DRIFT_TIERS: readonly number[];
export function driftTier(charge: number): number;
export function stepDrift(r: Racer, input: Input, dt: number): boolean;
export function boostPads(track: Track): { x: number; z: number; yaw: number; index: number; id: number; width: number }[];
export function stepBoostPads(r: Racer, track: Track, time: number): void;
export function stepSlipstream(racers: Racer[], dt: number): void;

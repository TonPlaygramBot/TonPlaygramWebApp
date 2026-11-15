import { standings } from './simulation.mjs';

export const RACE_FORMATS = Object.freeze(['race', 'combat', 'trial', 'championship']);
export const normalizeRaceFormat = (value) => RACE_FORMATS.includes(value) ? value : 'race';
export function bestTrialLap(racer) {
  // The timing gates invalidate recovery laps. Raw lapTimes also contains
  // invalid laps, so current racers must use their authoritative telemetry.
  if (racer.telemetry) {
    const best = racer.telemetry.bestLap;
    return Number.isFinite(best) && best > 0 ? best : Infinity;
  }
  const laps = (racer.lapTimes || []).filter((time) => Number.isFinite(time) && time > 0);
  return laps.length ? Math.min(...laps) : Infinity;
}
/** Only server-earned, ordered laps count. No lap ranks after any valid lap;
 * ties retain ordinary race standings so the ordering remains deterministic. */
export function trialStandings(racers) {
  return standings(racers).sort((a, b) => {
    const left = bestTrialLap(a), right = bestTrialLap(b);
    return left === right ? 0 : left < right ? -1 : 1;
  });
}

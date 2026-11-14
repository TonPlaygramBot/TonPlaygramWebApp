/** One objective source for the mission, road route, map and world beacon. */
export function operationTarget(mission, director, remaining = 0) {
  if (!mission?.operation) return null;
  if (mission.approach) {
    if (director?.operationStage === 'escape') return mission.stops[0];
    return director?.operationStage === 'secure' ? mission.combatZone : mission.approach;
  }
  return remaining > 0 ? mission.combatZone : mission.stops[0];
}

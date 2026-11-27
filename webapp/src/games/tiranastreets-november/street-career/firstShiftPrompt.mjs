/** Present the first-shift lesson for the controls the player can use right now. */
export function firstShiftPrompt({missionId, finished, objective, mode, learned}) {
  if (finished || missionId !== 'first-shift' || !objective?.training || mode === 'flying') return objective;
  if (mode === 'driving') {
    return learned.includes('drive')
      ? {...objective, title:'Stop before getting out', detail:'Hold BRAKE, then tap DIL.'}
      : {...objective, title:'Drive the car', detail:'Hold GAS and steer with the left stick. Use BRAKE to stop.'};
  }
  return objective;
}

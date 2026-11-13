const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
const bounded = (value, maximum) => Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
/** Pure objective director shared by the real game loop and simulation tests.
 * Capture checkpoints prevent one short retreat from erasing a whole defense;
 * interaction and extraction still require a safe, uninterrupted dwell. */
export function advanceBattleObjective(state, frame, dt) {
  dt = bounded(dt, .25);
  const next = {...state, progress: bounded(state.progress, frame.mode === 'hold' ? 45 : 3),
    extraction: bounded(state.extraction, 5), status: 'playing', intelSecured: false, extractionOpened: false,
    stage: 'eliminate', hint: 'Clear the hostile squad, then move to extraction.', contested: false,
    progressRatio: 0, timeRemaining: null, objectivePosition: {...frame.center}};
  if (frame.health <= 0) {next.status = 'lost'; next.stage = 'failed'; next.hint = 'Operator down. Restart the operation.'; return next;}
  let count = 0, contestCount = 0, intelGuards = 0, extractionGuards = 0;
  for (const enemy of frame.enemies) {
    if (enemy.hp <= 0) continue;
    count++;
    if (near(enemy, frame.center, 10)) contestCount++;
    if (near(enemy, frame.intelPoint, 3.5)) intelGuards++;
    if (near(enemy, frame.extractionPoint, 4)) extractionGuards++;
  }
  const cleared = frame.enemies.length > 0 && count === 0;
  const undamaged = frame.elapsed - frame.lastDamage > .75;
  if (frame.mode === 'last-stand') {
    next.stage = cleared ? 'complete' : 'survive'; next.status = cleared ? 'won' : 'playing';
    next.hint = cleared ? 'Last operator standing.' : `${count} rival${count === 1 ? '' : 's'} remain. Stay inside the combat zone.`;
    next.progressRatio = frame.enemies.length ? 1 - count / frame.enemies.length : 0;
    return next;
  }
  if (frame.mode === 'hold') {
    const onFoot = near(frame.player, frame.center, 10) && !frame.driving;
    next.contested = contestCount > 0;
    if (!next.contested && onFoot) next.progress = Math.min(45, next.progress + dt);
    else if (next.contested && !onFoot) next.progress = Math.max(Math.floor(next.progress / 15) * 15, next.progress - dt * .5);
    next.progressRatio = next.progress / 45;
    next.timeRemaining = Math.max(0, 300 - frame.elapsed);
    next.stage = next.contested ? 'contest' : 'capture';
    next.hint = next.contested ? onFoot ? 'Beacon contested. Push hostiles out of the capture circle.' : 'Hostiles are recapturing the beacon. Return to defend your checkpoint.'
      : frame.driving ? 'Leave the vehicle and hold the beacon on foot.' : onFoot ? `Hold position. ${Math.ceil(45 - next.progress)} seconds to secure the district.` : 'Move into the beacon circle to capture the district.';
    next.status = frame.elapsed > 300 ? 'lost' : next.progress >= 45 ? 'won' : cleared && frame.elapsed < 240 ? 'reinforce' : 'playing';
  } else {
    if (frame.mode === 'extraction' && !next.intel) {
      const inRange = near(frame.player, frame.intelPoint, 5);
      next.contested = intelGuards > 0;
      const safe = inRange && !frame.driving && !next.contested && undamaged;
      next.progress = safe ? Math.min(3, next.progress + dt) : 0;
      next.stage = 'collect'; next.objectivePosition = {...frame.intelPoint}; next.progressRatio = next.progress / 3;
      next.hint = next.contested ? 'Clear the guards beside the intel before collecting it.' : !undamaged && inRange ? 'Taking fire. Break contact before collecting the intel.'
        : frame.driving && inRange ? 'Leave the vehicle to collect the intel.' : inRange ? 'Collecting intel. Hold position for three seconds.' : 'Reach the intel beacon. Avoid patrols or clear a route.';
      if (next.progress >= 3) {next.intel = true; next.intelSecured = true; next.extracting = true;}
    }
    if (cleared && !next.extracting) {
      if (frame.mode === 'sweep' || frame.mode === 'waves' && frame.wave >= 3) next.extracting = true;
      else if (frame.mode === 'waves') {next.status = 'upgrade'; next.stage = 'upgrade'; next.hint = 'Wave secured. Choose an upgrade before the next squad arrives.';}
    }
    next.extractionOpened = next.extracting && !state.extracting;
    if (next.extracting) {
      const inRange = near(frame.player, frame.extractionPoint, 2.6);
      next.contested = extractionGuards > 0;
      const safe = inRange && !frame.driving && undamaged && !next.contested;
      next.extraction = safe ? Math.min(5, next.extraction + dt) : 0;
      next.stage = inRange ? 'extract' : 'escape'; next.objectivePosition = {...frame.extractionPoint}; next.progressRatio = next.extraction / 5;
      next.hint = next.contested ? 'Extraction blocked. Clear the guards from the landing zone.' : !inRange ? 'Reach extraction with your squad objective secured.'
        : frame.driving ? 'Leave the vehicle to board extraction.' : !undamaged ? 'Taking fire. Secure the landing zone to restart extraction.' : `Extracting. Hold for ${Math.ceil(5 - next.extraction)} seconds.`;
      if (next.extraction >= 5) next.status = 'won';
    } else if (next.stage === 'eliminate') {
      next.progressRatio = frame.enemies.length ? 1 - count / frame.enemies.length : 0;
      next.hint = frame.mode === 'waves' ? `Wave ${frame.wave}/3. ${count} hostile${count === 1 ? '' : 's'} remain; resupply between waves.` : `${count} hostile${count === 1 ? '' : 's'} remain. Clear the district to open extraction.`;
    }
  }
  if (next.status === 'won') {next.stage = 'complete'; next.progressRatio = 1; next.hint = 'Objective complete. District secured.';}
  if (next.status === 'lost') {next.stage = 'failed'; next.hint = 'The operation window has closed. Regroup and retry.';}
  return next;
}

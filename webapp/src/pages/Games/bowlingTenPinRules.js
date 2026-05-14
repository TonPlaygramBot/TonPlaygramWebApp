export const OFFICIAL_TEN_PIN_RULE_SUMMARY =
  'Official ten-pin: 10 frames · max two rolls per frames 1-9 unless strike · strike scores 10 plus next two rolls · spare scores 10 plus next roll · open frame scores pinfall · 10th frame grants bonus rolls only after strike/spare · each full rack is limited to 10 pins.';

export function frameComplete(frame, index) {
  const r = frame.rolls || [];
  if (index < 9) return r[0] === 10 || r.length >= 2;
  if (r.length < 2) return false;
  if (r[0] === 10 || r[0] + r[1] === 10) return r.length >= 3;
  return r.length >= 2;
}

export function currentFrameIndex(player) {
  const idx = player.frames.findIndex((f, i) => !frameComplete(f, i));
  return idx === -1 ? 9 : idx;
}

export function playerFinished(player) {
  return player.frames.every((f, i) => frameComplete(f, i));
}

export function getLegalTenPinMax(frame, frameIndex, rollIndex) {
  if (frameIndex < 9)
    return rollIndex === 0 ? 10 : Math.max(0, 10 - (frame.rolls[0] || 0));
  if (rollIndex === 0) return 10;
  if (rollIndex === 1)
    return frame.rolls[0] === 10 ? 10 : Math.max(0, 10 - (frame.rolls[0] || 0));
  if (rollIndex === 2) {
    if (frame.rolls[0] === 10 && frame.rolls[1] !== 10)
      return Math.max(0, 10 - (frame.rolls[1] || 0));
    return 10;
  }
  return 0;
}

export function clampTenPinRoll(frame, frameIndex, rollIndex, knocked) {
  const max = getLegalTenPinMax(frame, frameIndex, rollIndex);
  return Math.max(0, Math.min(max, Math.round(Number(knocked) || 0)));
}

export function recomputePlayerTotals(player) {
  const flat = player.frames.flatMap((f) => f.rolls);
  let rollIndex = 0;
  let running = 0;

  for (let frame = 0; frame < 10; frame++) {
    const out = player.frames[frame];
    out.cumulative = null;

    if (frame < 9) {
      const a = flat[rollIndex];
      if (a == null) break;
      if (a === 10) {
        const b = flat[rollIndex + 1];
        const c = flat[rollIndex + 2];
        if (b == null || c == null) break;
        running += 10 + b + c;
        out.cumulative = running;
        rollIndex += 1;
      } else {
        const b = flat[rollIndex + 1];
        if (b == null) break;
        const base = a + b;
        if (base === 10) {
          const c = flat[rollIndex + 2];
          if (c == null) break;
          running += 10 + c;
        } else running += base;
        out.cumulative = running;
        rollIndex += 2;
      }
    } else {
      if (!frameComplete(out, frame)) break;
      running += out.rolls.reduce((s, v) => s + v, 0);
      out.cumulative = running;
    }
  }

  player.total = running;
  return player;
}

export function shouldResetPinsForNextRoll(
  frame,
  frameIndex,
  rollIndex,
  knocked,
  frameEnded
) {
  if (frameEnded) return true;
  if (frameIndex < 9) return knocked === 10;
  if (rollIndex === 0) return knocked === 10;
  if (rollIndex === 1)
    return frame.rolls[0] === 10 || frame.rolls[0] + frame.rolls[1] === 10;
  return false;
}

export function addTenPinRoll(player, knocked) {
  const frameIndex = currentFrameIndex(player);
  const frame = player.frames[frameIndex];
  const rollIndex = frame.rolls.length;
  const legalKnocked = clampTenPinRoll(frame, frameIndex, rollIndex, knocked);
  if (rollIndex < (frameIndex < 9 ? 2 : 3)) frame.rolls.push(legalKnocked);
  recomputePlayerTotals(player);
  const frameEnded = frameComplete(frame, frameIndex);
  return {
    frameIndex,
    rollIndex,
    knocked: legalKnocked,
    frameEnded,
    resetPins: shouldResetPinsForNextRoll(
      frame,
      frameIndex,
      rollIndex,
      legalKnocked,
      frameEnded
    ),
    gameFinished: playerFinished(player)
  };
}

const clampPins = (value, maximum) =>
  Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0)));

export function frameComplete (frame, frameIndex) {
  const rolls = frame?.rolls || [];
  if (frameIndex < 9) return rolls[0] === 10 || rolls.length >= 2;
  if (rolls.length < 2) return false;
  const earnedBonus = rolls[0] === 10 || rolls[0] + rolls[1] === 10;
  return earnedBonus ? rolls.length >= 3 : true;
}

export function getLegalTenPinMax (frame, frameIndex, rollIndex = frame?.rolls?.length || 0) {
  const rolls = frame?.rolls || [];
  if (frameIndex < 9) return rollIndex === 0 ? 10 : Math.max(0, 10 - (rolls[0] || 0));
  if (rollIndex === 0) return 10;
  if (rollIndex === 1) return rolls[0] === 10 ? 10 : Math.max(0, 10 - (rolls[0] || 0));
  if (rolls[0] === 10) return rolls[1] === 10 ? 10 : Math.max(0, 10 - (rolls[1] || 0));
  return rolls[0] + rolls[1] === 10 ? 10 : 0;
}

export function recomputePlayerTotals (player) {
  const frames = player.frames || [];
  const allRolls = frames.flatMap((frame) => frame.rolls || []);
  let rollOffset = 0;
  let cumulative = 0;

  frames.forEach((frame, frameIndex) => {
    const rolls = frame.rolls || [];
    let score = null;
    if (frameIndex === 9) {
      if (frameComplete(frame, frameIndex)) score = rolls.reduce((sum, pins) => sum + pins, 0);
    } else if (rolls[0] === 10) {
      const bonus = allRolls.slice(rollOffset + 1, rollOffset + 3);
      if (bonus.length === 2) score = 10 + bonus[0] + bonus[1];
    } else if (rolls.length >= 2 && rolls[0] + rolls[1] === 10) {
      const bonus = allRolls[rollOffset + 2];
      if (bonus !== undefined) score = 10 + bonus;
    } else if (rolls.length >= 2) {
      score = rolls[0] + rolls[1];
    }

    if (score == null) {
      frame.cumulative = null;
    } else {
      cumulative += score;
      frame.cumulative = cumulative;
    }
    rollOffset += rolls.length;
  });

  player.total = cumulative;
  return cumulative;
}

export function addTenPinRoll (player, requestedPins, options = {}) {
  const frames = player.frames || [];
  const frameIndex = frames.findIndex((frame, index) => !frameComplete(frame, index));
  if (frameIndex === -1) return { accepted: false, gameFinished: true, knocked: 0, foul: false };

  const frame = frames[frameIndex];
  const rollIndex = frame.rolls.length;
  const maximum = getLegalTenPinMax(frame, frameIndex, rollIndex);
  const foul = Boolean(options.foul);
  const knocked = foul ? 0 : clampPins(requestedPins, maximum);
  frame.rolls.push(knocked);
  recomputePlayerTotals(player);

  return {
    accepted: true,
    frameIndex,
    rollIndex,
    knocked,
    foul,
    gameFinished: frames.every((candidate, index) => frameComplete(candidate, index))
  };
}

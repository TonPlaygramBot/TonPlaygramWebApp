// Original coaching curriculum. Coordinates are fractions of the playable half extents.
const ball = (x, z, rackIndex = 0, target = true) => ({
  x,
  z,
  rackIndex,
  target
});
export const COACHING_DRILLS = [
  {
    id: 'pot',
    title: 'Pocket pace',
    skill: 'Potting',
    objective: 'Clear the single ball into the side pocket without scratching.',
    tip: 'Aim through the centre of the ball. Start with a gentle stroke.',
    cue: { x: -0.5, z: 0 },
    balls: [ball(0.48, 0)],
    goal: 'clear',
    shots: 3
  },
  {
    id: 'stop',
    title: 'Stop on the spot',
    skill: 'Stun',
    objective: 'Pot the ball and stop the cue ball inside the marked zone.',
    tip: 'Strike close to centre with a smooth, firm delivery.',
    cue: { x: -0.55, z: 0 },
    balls: [ball(0.18, 0)],
    goal: 'position',
    zone: { x: 0.18, z: 0, radius: 0.19 },
    shots: 3
  },
  {
    id: 'draw',
    title: 'Draw back',
    skill: 'Draw',
    objective:
      'Pot the ball with backspin and bring the cue ball back into the marked zone.',
    tip: 'Choose below centre on the spin ball. Deliver through the ball.',
    cue: { x: -0.45, z: 0 },
    balls: [ball(0.12, 0)],
    goal: 'position',
    spin: 'draw',
    zone: { x: -0.22, z: 0, radius: 0.29 },
    shots: 3
  },
  {
    id: 'follow',
    title: 'Follow into shape',
    skill: 'Follow',
    objective:
      'Pot with topspin and roll the cue ball forward into the marked zone.',
    tip: 'Choose above centre, then use enough pace to reach the zone.',
    cue: { x: -0.5, z: 0 },
    balls: [ball(0.1, 0)],
    goal: 'position',
    spin: 'follow',
    zone: { x: 0.44, z: 0, radius: 0.23 },
    shots: 3
  },
  {
    id: 'cut',
    title: 'Cut-shot judgement',
    skill: 'Potting',
    objective: 'Clear the angled ball without scratching.',
    tip: 'Aim at the contact point, then commit to one smooth stroke.',
    cue: { x: -0.4, z: -0.35 },
    balls: [ball(0.5, 0.48)],
    goal: 'clear',
    shots: 3
  },
  {
    id: 'left',
    title: 'Left english',
    skill: 'Sidespin',
    objective:
      'Pot the ball using left spin and keep the cue ball on the table.',
    tip: 'Select left on the spin ball. Watch the cue-ball rebound.',
    cue: { x: -0.45, z: -0.3 },
    balls: [ball(0.55, 0.52)],
    goal: 'clear',
    spin: 'left',
    shots: 3
  },
  {
    id: 'right',
    title: 'Right english',
    skill: 'Sidespin',
    objective:
      'Pot the ball using right spin and keep the cue ball on the table.',
    tip: 'Select right on the spin ball. Compare the rail response.',
    cue: { x: -0.45, z: 0.3 },
    balls: [ball(0.55, -0.52)],
    goal: 'clear',
    spin: 'right',
    shots: 3
  },
  {
    id: 'kick',
    title: 'Escape the snooker',
    skill: 'Escapes',
    objective:
      'Reach a cushion before contacting the yellow target. Leave the red blocker alone.',
    tip: 'Use the long cushion to get around the blocker; a pot is optional.',
    cue: { x: -0.55, z: 0 },
    balls: [ball(0.32, 0), ball(-0.1, 0, 2, false)],
    goal: 'escape',
    shots: 4
  },
  {
    id: 'pattern',
    title: 'Two-ball route',
    skill: 'Position',
    objective: 'Clear both balls within the shot allowance.',
    tip: 'Plan the second shot before playing the first.',
    cue: { x: -0.55, z: -0.3 },
    balls: [ball(0.25, -0.3), ball(0.52, 0.46, 1)],
    goal: 'clear',
    shots: 4
  },
  {
    id: 'finish',
    title: 'Three-ball finish',
    skill: 'Position',
    objective: 'Clear the three-ball pattern with no scratch.',
    tip: 'Choose the easiest route and preserve an angle for your last ball.',
    cue: { x: -0.55, z: 0.2 },
    balls: [ball(0.2, 0.1), ball(0.48, 0.5, 1), ball(-0.4, -0.45, 2)],
    goal: 'clear',
    shots: 5
  }
];

export function coachingDefinition(level) {
  const tier = Math.floor((level - 1) / COACHING_DRILLS.length);
  const drill = COACHING_DRILLS[(level - 1) % COACHING_DRILLS.length];
  const mirror = tier % 2 ? -1 : 1;
  const transform = (point) => ({ ...point, z: point.z * mirror });
  return {
    ...drill,
    level,
    tier,
    title: `Task ${String(level).padStart(2, '0')} · ${drill.title}`,
    difficulty: ['Foundation', 'Club', 'County', 'National', 'Tour'][tier],
    shotLimit: Math.max(
      drill.balls.filter((b) => b.target).length,
      drill.shots - Math.floor(tier / 2)
    ),
    zone: drill.zone
      ? {
          ...transform(drill.zone),
          radius: drill.zone.radius * (1 - tier * 0.11)
        }
      : null,
    layout: { cue: transform(drill.cue), balls: drill.balls.map(transform) }
  };
}

export function evaluateCoachingShot(drill, observation) {
  const {
    shots,
    cue,
    pottedTargets,
    targetCount,
    scratched,
    blockerPotted,
    firstTargetHit,
    cushionBeforeContact,
    spin = {}
  } = observation;
  const fail = (feedback) => ({ status: 'retry', feedback, stars: 0 });
  if (scratched)
    return fail(
      'Scratch. Reduce pace and keep the cue ball away from a pocket.'
    );
  if (blockerPotted)
    return fail('The blocker was potted. Use a cushion to reach the target.');
  const cleared = targetCount > 0 && pottedTargets >= targetCount;
  const escaped = firstTargetHit && cushionBeforeContact;
  let correctSpin = true;
  if (drill.spin === 'draw') correctSpin = spin.y < -0.12;
  if (drill.spin === 'follow') correctSpin = spin.y > 0.12;
  if (drill.spin === 'left') correctSpin = spin.x < -0.12;
  if (drill.spin === 'right') correctSpin = spin.x > 0.12;
  const inZone =
    !drill.zone ||
    (Number.isFinite(cue?.x) &&
      Number.isFinite(cue?.z) &&
      Math.hypot(cue.x - drill.zone.x, cue.z - drill.zone.z) <=
        drill.zone.radius);
  if ((drill.goal === 'escape' ? escaped : cleared) && correctSpin && inZone) {
    return {
      status: 'complete',
      feedback: 'Objective achieved. Good cue-ball control.',
      stars: shots <= targetCount ? 3 : shots < drill.shotLimit ? 2 : 1
    };
  }
  if (cleared && drill.goal !== 'escape')
    return fail(
      !correctSpin
        ? `Use the requested ${drill.spin} spin, then retry.`
        : 'The pot was good; the cue ball finished outside the zone. Adjust pace.'
    );
  if (shots >= drill.shotLimit)
    return fail('Shot allowance used. Review your route and try again.');
  return {
    status: 'playing',
    feedback:
      drill.goal === 'escape'
        ? 'Touch a cushion before the target.'
        : `${targetCount - pottedTargets} target ball(s) left.`,
    stars: 0
  };
}

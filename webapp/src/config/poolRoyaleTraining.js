const DIFFICULTY_LABELS = ['Intro', 'Rookie', 'Challenger', 'Advanced', 'Elite'];

const TRAINING_BLUEPRINTS = [
  {
    title: 'Corner tap-in',
    discipline: 'American Billiards',
    objective: 'Feather the overhanging ball into the corner without scratching.',
    cue: { x: -0.62, z: -0.68 },
    balls: [{ rackIndex: 1, x: 0.78, z: 0.84 }],
    tip: 'Gently roll through center ball to let gravity do the work.',
    shotLimit: 3
  },
  {
    title: 'Side pocket control',
    discipline: 'UK 8-Ball',
    objective: 'Slide the ball into the side pocket while keeping the cue ball out of the scratch lanes.',
    cue: { x: -0.48, z: -0.32 },
    balls: [{ rackIndex: 2, x: -0.02, z: 0.24 }],
    tip: 'Favor a touch of stun and aim for the heart of the side jaw.',
    shotLimit: 3
  },
  {
    title: 'Long straight stun',
    discipline: 'American Billiards',
    objective: 'Drill the down-table ball cleanly and leave the cue ball centred for the next shot.',
    cue: { x: -0.36, z: 0.52 },
    balls: [{ rackIndex: 3, x: 0, z: -0.64 }],
    tip: 'Keep the stroke smooth and stay on the vertical axis for a firm stop.',
    shotLimit: 4
  },
  {
    title: 'Back-cut to corner',
    discipline: 'UK 8-Ball',
    objective: 'Cut the ball back to the near corner and check the cue ball off the short rail.',
    cue: { x: -0.58, z: -0.12 },
    balls: [{ rackIndex: 4, x: 0.54, z: 0.18 }],
    tip: 'Aim thin, trust the throw, and keep the speed under control.',
    shotLimit: 4
  },
  {
    title: 'Two-ball pattern',
    discipline: 'American Billiards',
    objective: 'Clear two open balls while floating gently into shape.',
    cue: { x: -0.52, z: -0.28 },
    balls: [
      { rackIndex: 6, x: 0.28, z: -0.22 },
      { rackIndex: 7, x: 0.46, z: 0.38 }
    ],
    tip: 'Play the nearer ball first and let a soft follow open the angle.',
    shotLimit: 5
  },
  {
    title: '9-ball starter',
    discipline: '9-Ball',
    objective: 'Pocket the 1-ball in the side and drift down-table for position.',
    cue: { x: -0.44, z: -0.36 },
    balls: [
      { rackIndex: 1, x: -0.06, z: 0.14 },
      { rackIndex: 9, x: 0.38, z: 0.52 }
    ],
    tip: 'Favor a thin hit so the cue ball clears the top rail safely.',
    shotLimit: 4
  },
  {
    title: 'Bank safety',
    discipline: 'American Billiards',
    objective: 'Bank off the long rail, pocket the ball, and hide behind the blocker.',
    cue: { x: -0.62, z: -0.14 },
    balls: [
      { rackIndex: 8, x: 0.18, z: 0.66 },
      { rackIndex: 11, x: 0.34, z: 0.18 }
    ],
    tip: 'Let the blocker do the defensive work after the rail-first contact.',
    shotLimit: 4
  },
  {
    title: 'Ladder drill',
    discipline: 'UK 8-Ball',
    objective: 'Work up the long rail through three balls without losing angle.',
    cue: { x: -0.28, z: -0.48 },
    balls: [
      { rackIndex: 10, x: 0.16, z: -0.32 },
      { rackIndex: 12, x: 0.18, z: -0.06 },
      { rackIndex: 13, x: 0.18, z: 0.26 }
    ],
    tip: 'Use gentle follow to step the cue ball up-table one pocket at a time.',
    shotLimit: 6
  },
  {
    title: 'Kick escape',
    discipline: '9-Ball',
    objective: 'Kick to the lowest ball first and stay safe after contact.',
    cue: { x: -0.64, z: -0.08 },
    balls: [
      { rackIndex: 5, x: 0.08, z: 0.7 },
      { rackIndex: 9, x: 0.52, z: 0.4 }
    ],
    tip: 'Use the rail to guarantee a legal hit and bleed speed on return.',
    shotLimit: 4
  },
  {
    title: 'Combo finisher',
    discipline: 'American Billiards',
    objective: 'Nudge the lead ball to combo the hanger while keeping shape.',
    cue: { x: -0.46, z: -0.22 },
    balls: [
      { rackIndex: 14, x: 0.62, z: 0.18 },
      { rackIndex: 15, x: 0.66, z: 0.12 }
    ],
    tip: 'Commit to the line and let the combo fall with pocket speed.',
    shotLimit: 5
  }
];

const clamp = (value) => Math.max(-0.94, Math.min(0.94, value));

const DISCIPLINE_TO_VARIANT = {
  'UK 8-Ball': 'uk',
  '9-Ball': '9ball',
  'American Billiards': 'american'
};

const DIFFICULTY_STEPS = [
  { label: DIFFICULTY_LABELS[0], spread: 0, drift: 0, shotBonus: 0, rewardBonus: 0 },
  { label: DIFFICULTY_LABELS[1], spread: 0.02, drift: 0.02, shotBonus: 1, rewardBonus: 12 },
  { label: DIFFICULTY_LABELS[2], spread: 0.035, drift: 0.03, shotBonus: 2, rewardBonus: 24 },
  { label: DIFFICULTY_LABELS[3], spread: 0.045, drift: 0.04, shotBonus: 3, rewardBonus: 36 },
  { label: DIFFICULTY_LABELS[4], spread: 0.06, drift: 0.05, shotBonus: 4, rewardBonus: 48 }
];

function resolveShotLimit(blueprint, tier) {
  const base = Number.isFinite(blueprint?.shotLimit) ? blueprint.shotLimit : 3;
  const scaled = base + (tier?.shotBonus ?? 0);
  return Math.min(10, Math.max(1, scaled));
}

export const TRAINING_SCENARIOS = (() => {
  const scenarios = [];
  let level = 1;

  for (const tier of DIFFICULTY_STEPS) {
    for (const blueprint of TRAINING_BLUEPRINTS) {
      const balls = blueprint.balls.map((ball, idx) => {
        const lateral = (idx % 2 === 0 ? 1 : -1) * tier.spread;
        const depth = (idx % 3 === 0 ? -1 : 1) * tier.drift;
        return {
          rackIndex: ball.rackIndex,
          x: clamp(ball.x + lateral),
          z: clamp(ball.z + depth)
        };
      });

      const cue = {
        x: clamp((blueprint.cue?.x ?? -0.4) - tier.spread * 0.5),
        z: clamp((blueprint.cue?.z ?? -0.2) - tier.drift * 0.6)
      };

      const shotLimit = resolveShotLimit(blueprint, tier);
      const variant = DISCIPLINE_TO_VARIANT[blueprint.discipline] || 'american';
      const reward = Math.round(60 + level * 10 + (tier.rewardBonus || 0));
      scenarios.push({
        level,
        title: `${blueprint.title} (${blueprint.discipline})`,
        discipline: blueprint.discipline,
        objective: blueprint.objective,
        description: `${blueprint.objective} — ${blueprint.discipline} path ${tier.label}.`,
        cue,
        balls,
        tip: blueprint.tip,
        difficultyLabel: tier.label,
        shotLimit,
        variant,
        reward,
        nft: level % 10 === 0
      });
      level += 1;
    }
  }
  return scenarios;
})();

export function getTrainingScenario(level = 1) {
  if (!Number.isFinite(level)) return TRAINING_SCENARIOS[0];
  const index = Math.max(0, Math.min(TRAINING_SCENARIOS.length - 1, Math.floor(level - 1)));
  return TRAINING_SCENARIOS[index];
}

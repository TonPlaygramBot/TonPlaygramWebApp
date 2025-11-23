const DIFFICULTY_LABELS = ['Intro', 'Rookie', 'Challenger', 'Advanced', 'Elite'];

const TRAINING_TEMPLATES = [
  {
    title: 'Tap-in to corner',
    discipline: 'American Billiards',
    objective: 'Feather the overhanging ball into the corner without scratching.',
    cue: { x: -0.55, z: -0.6 },
    balls: [{ rackIndex: 1, x: 0.82, z: 0.82 }],
    tip: 'Gently roll through center ball to let gravity do the work.'
  },
  {
    title: 'UK 8-ball cut',
    discipline: 'UK 8-Ball',
    objective: 'Cut the object ball to the corner and hold the cue ball for the next shot.',
    cue: { x: -0.38, z: -0.18 },
    balls: [{ rackIndex: 2, x: 0.42, z: 0.24 }],
    tip: 'Use a soft stun and favor the center of the pocket mouth.'
  },
  {
    title: 'Side pocket tester',
    discipline: 'UK 8-Ball',
    objective: 'Slide the ball into the side pocket while avoiding the scratch lanes.',
    cue: { x: -0.62, z: 0.02 },
    balls: [{ rackIndex: 3, x: 0.02, z: 0.08 }],
    tip: 'Aim for the middle of the side opening and keep the pace light.'
  },
  {
    title: 'Long rail bank',
    discipline: 'American Billiards',
    objective: 'Bank off the long rail and drop the ball in the opposite corner.',
    cue: { x: -0.65, z: -0.45 },
    balls: [{ rackIndex: 4, x: 0.28, z: 0.46 }],
    tip: 'Mirror the line with the diamonds and commit to a medium stroke.'
  },
  {
    title: '9-ball side starter',
    discipline: '9-Ball',
    objective: 'Pocket the 1-ball in the side and drift down-table for position.',
    cue: { x: -0.44, z: -0.38 },
    balls: [
      { rackIndex: 1, x: -0.02, z: 0.12 },
      { rackIndex: 9, x: 0.46, z: 0.46 }
    ],
    tip: 'Favor a thin hit so the cue ball clears the top rail safely.'
  },
  {
    title: 'Two-ball pattern',
    discipline: 'American Billiards',
    objective: 'Clear two open balls while floating gently into shape.',
    cue: { x: -0.46, z: -0.26 },
    balls: [
      { rackIndex: 6, x: 0.24, z: -0.12 },
      { rackIndex: 7, x: 0.38, z: 0.34 }
    ],
    tip: 'Play the nearer ball first and let a soft follow open the angle.'
  },
  {
    title: 'Three-ball ladder',
    discipline: 'UK 8-Ball',
    objective: 'Work up the rail through three balls without losing angle.',
    cue: { x: -0.32, z: -0.36 },
    balls: [
      { rackIndex: 8, x: 0.18, z: -0.26 },
      { rackIndex: 10, x: 0.34, z: -0.06 },
      { rackIndex: 11, x: 0.5, z: 0.14 }
    ],
    tip: 'Use gentle follow to step the cue ball up-table one pocket at a time.'
  },
  {
    title: 'Safety tuck',
    discipline: 'American Billiards',
    objective: 'Hide the cue ball behind a blocker after contacting the target.',
    cue: { x: -0.52, z: -0.2 },
    balls: [
      { rackIndex: 12, x: 0.22, z: 0.1 },
      { rackIndex: 13, x: 0.36, z: 0.14 }
    ],
    tip: 'Feather the hit and let the blocker carry the defensive weight.'
  },
  {
    title: 'Double-kiss escape',
    discipline: 'UK 8-Ball',
    objective: 'Use the long rail to double the ball back to the corner.',
    cue: { x: -0.58, z: 0.36 },
    balls: [{ rackIndex: 14, x: 0.24, z: 0.64 }],
    tip: 'Count the diamonds and trust the mirror line to find the pocket center.'
  },
  {
    title: 'Rail-first 9-ball',
    discipline: '9-Ball',
    objective: 'Kick at the lowest ball first and open the rack without fouling.',
    cue: { x: -0.62, z: -0.12 },
    balls: [
      { rackIndex: 1, x: 0.02, z: -0.3 },
      { rackIndex: 9, x: 0.46, z: 0.28 }
    ],
    tip: 'Use the rail to guarantee a legal hit and let the cue ball run free.'
  }
];

const clamp = (value) => Math.max(-0.94, Math.min(0.94, value));

const DISCIPLINE_TO_VARIANT = {
  'UK 8-Ball': 'uk',
  '9-Ball': '9ball',
  'American Billiards': 'american'
};

function resolveShotLimit(template, tier) {
  const base = 3 + (template?.balls?.length || 1);
  const tierBonus = Math.max(0, tier - 1);
  return Math.min(10, base + tierBonus);
}

export const TRAINING_SCENARIOS = (() => {
  const scenarios = [];
  for (let i = 0; i < 50; i++) {
    const level = i + 1;
    const template = TRAINING_TEMPLATES[i % TRAINING_TEMPLATES.length];
    const tier = Math.min(DIFFICULTY_LABELS.length - 1, Math.floor(i / 10));
    const drift = (level % 5) * 0.018 + tier * 0.02;
    const rotation = ((level + 1) % 2 === 0 ? 1 : -1) * 0.03 * tier;

    const balls = template.balls.map((ball, idx) => {
      const xOffset = (idx % 2 === 0 ? 1 : -1) * drift + rotation;
      const zOffset = (idx % 2 === 0 ? -1 : 1) * drift;
      return {
        rackIndex: ball.rackIndex,
        x: clamp(ball.x + xOffset),
        z: clamp(ball.z + zOffset)
      };
    });

    if (tier >= 2 && template.balls.length < 3) {
      balls.push({ rackIndex: 15 + tier, x: clamp(0.32 - drift), z: clamp(0.22 + drift) });
    }
    if (tier >= 3) {
      balls.push({ rackIndex: 30 + tier, x: clamp(-0.18 - rotation), z: clamp(-0.14 - drift) });
    }

    const cue = {
      x: clamp((template.cue?.x ?? -0.4) - drift * 0.6),
      z: clamp((template.cue?.z ?? -0.2) - drift * 0.35)
    };

    const shotLimit = resolveShotLimit(template, tier);
    const variant = DISCIPLINE_TO_VARIANT[template.discipline] || 'american';
    scenarios.push({
      level,
      title: `${template.title} (${template.discipline})`,
      discipline: template.discipline,
      objective: template.objective,
      description: `${template.objective} — ${template.discipline} path ${DIFFICULTY_LABELS[tier]}.`,
      cue,
      balls,
      tip: template.tip,
      difficultyLabel: DIFFICULTY_LABELS[tier],
      shotLimit,
      variant,
      reward: 60 + level * 12,
      nft: level % 10 === 0
    });
  }
  return scenarios;
})();

export function getTrainingScenario(level = 1) {
  if (!Number.isFinite(level)) return TRAINING_SCENARIOS[0];
  const index = Math.max(0, Math.min(TRAINING_SCENARIOS.length - 1, Math.floor(level - 1)));
  return TRAINING_SCENARIOS[index];
}

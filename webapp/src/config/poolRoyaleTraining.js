export const TRAINING_SCENARIOS = (() => {
  const baseLayouts = [
    {
      title: 'Tap-in to corner',
      description: 'Pocket a ball that is hanging over the corner with simple center-ball strike.',
      cue: { x: -0.55, z: -0.6 },
      balls: [{ rackIndex: 7, x: 0.82, z: 0.82 }],
      tip: 'Feather the cue and roll the ball gently into the pocket.'
    },
    {
      title: 'Mid-distance stun',
      description: 'Stop the cue ball after contact on a mid-table cut.',
      cue: { x: -0.35, z: -0.2 },
      balls: [
        { rackIndex: 2, x: 0.35, z: 0.18 },
        { rackIndex: 6, x: 0.55, z: -0.1 }
      ],
      tip: 'Keep the tip at center ball and use a crisp stroke.'
    },
    {
      title: 'Soft follow',
      description: 'Float the cue ball forward for next position after a short pot.',
      cue: { x: -0.5, z: -0.25 },
      balls: [{ rackIndex: 3, x: 0.55, z: -0.35 }],
      tip: 'Drag the spin marker just above center and use light power.'
    },
    {
      title: 'Controlled draw',
      description: 'Pull the cue ball back a few inches for shape.',
      cue: { x: -0.4, z: -0.15 },
      balls: [{ rackIndex: 4, x: 0.45, z: -0.05 }],
      tip: 'Aim below center with a smooth acceleration.'
    },
    {
      title: 'Side pocket test',
      description: 'Cut a ball to the side pocket without scratching.',
      cue: { x: -0.6, z: 0.0 },
      balls: [{ rackIndex: 5, x: 0.0, z: 0.02 }],
      tip: 'Favor a trace of stun to keep the cue ball away from the corner.'
    },
    {
      title: 'Long rail bank',
      description: 'Bank a ball off the long rail to the opposite corner.',
      cue: { x: -0.65, z: -0.45 },
      balls: [{ rackIndex: 8, x: 0.25, z: 0.4 }],
      tip: 'Visualize the mirror angle and strike with medium pace.'
    },
    {
      title: 'Two-ball pattern',
      description: 'Clear two open balls with simple position routes.',
      cue: { x: -0.45, z: -0.25 },
      balls: [
        { rackIndex: 1, x: 0.25, z: -0.15 },
        { rackIndex: 9, x: 0.4, z: 0.35 }
      ],
      tip: 'Play the easier ball first and float to the second angle.'
    },
    {
      title: 'Three-ball ladder',
      description: 'Run a short three-ball ladder staying on the same rail.',
      cue: { x: -0.35, z: -0.35 },
      balls: [
        { rackIndex: 10, x: 0.2, z: -0.25 },
        { rackIndex: 11, x: 0.35, z: -0.05 },
        { rackIndex: 12, x: 0.5, z: 0.15 }
      ],
      tip: 'Use soft follow to move up-table a few inches at a time.'
    },
    {
      title: 'Nine-ball break shot',
      description: 'Start with the 1-ball in the side and open the 9 for the win.',
      cue: { x: -0.4, z: -0.4 },
      balls: [
        { rackIndex: 0, x: -0.05, z: 0.1 },
        { rackIndex: 8, x: 0.45, z: 0.45 }
      ],
      tip: 'Aim thin on the 1-ball to send the cue ball down-table.'
    },
    {
      title: 'Safety lock-up',
      description: 'Hide the cue ball behind a blocker after contact.',
      cue: { x: -0.5, z: -0.2 },
      balls: [
        { rackIndex: 13, x: 0.2, z: 0.1 },
        { rackIndex: 14, x: 0.35, z: 0.12 }
      ],
      tip: 'Use soft stun and a blocker ball to deny a reply.'
    }
  ];

  const scenarios = [];
  for (let i = 0; i < 50; i++) {
    const base = baseLayouts[i % baseLayouts.length];
    const level = i + 1;
    const drift = (level % 5) * 0.04;
    const rotatedBalls = base.balls.map((ball, idx) => ({
      ...ball,
      x: Math.max(-0.9, Math.min(0.9, ball.x + (idx % 2 === 0 ? drift : -drift))),
      z: Math.max(-0.9, Math.min(0.9, ball.z + (idx % 2 === 0 ? -drift : drift)))
    }));
    const cue = {
      x: Math.max(-0.9, Math.min(0.9, (base.cue?.x ?? -0.4) + drift * 0.5)),
      z: Math.max(-0.9, Math.min(0.9, (base.cue?.z ?? -0.2) - drift * 0.4))
    };
    scenarios.push({
      level,
      title: base.title,
      description: `${base.description} (Level ${level})`,
      cue,
      balls: rotatedBalls,
      tip: base.tip,
      reward: 50 + level * 10,
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

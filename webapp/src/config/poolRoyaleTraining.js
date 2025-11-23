const DEFAULT_LAYOUT = {
  level: 1,
  title: 'Free practice',
  discipline: 'Practice table',
  objective: 'Shoot freely with your chosen training setup.',
  description: 'Use the in-game training menu to pick your opponent and rules.',
  cue: { x: -0.4, z: -0.2 },
  balls: [],
  tip: 'Tap the training badge in the top right to swap between solo, AI, rules on or rules off.',
  difficultyLabel: 'Open',
  shotLimit: null,
  variant: 'american',
  reward: 0,
  nft: false
};

export const TRAINING_SCENARIOS = [DEFAULT_LAYOUT];

export function getTrainingScenario() {
  return DEFAULT_LAYOUT;
}

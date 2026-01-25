const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  arena: 'Snooker Royal arena',
  table: 'main table',
  color: 'the color',
  points: 'four',
  foulReason: 'foul',
  breakTotal: '0',
  scoreline: 'level',
  frameNumber: 'this frame'
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  breakOff: 'breakOff',
  redPot: 'redPot',
  multiRed: 'multiRed',
  colorPot: 'colorPot',
  colorOrder: 'colorOrder',
  respot: 'respot',
  safety: 'safety',
  snooker: 'snooker',
  freeBall: 'freeBall',
  foul: 'foul',
  miss: 'miss',
  breakBuild: 'breakBuild',
  century: 'century',
  colorsOrder: 'colorsOrder',
  frameBall: 'frameBall',
  frameWin: 'frameWin',
  outro: 'outro',
  turn: 'turn'
});

const TEMPLATES = Object.freeze({
  intro: [
    'Welcome to {arena}. {player} and {opponent} are set for {frameNumber}.',
    'We are live at {arena}. {player} versus {opponent}, and the table is ready.',
    'Good evening from {arena}. {player} and {opponent} prepare to open {frameNumber}.'
  ],
  breakOff: [
    'Here comes the break-off from {player}. All about control and the baulk line.',
    '{player} to break the pack. The cue ball needs to stay safe in baulk.',
    '{player} steps in for the opener. Gentle break, heavy on precision.'
  ],
  redPot: [
    'Red down for {player}. The break is alive.',
    '{player} drops a red and stays in position.',
    'That red is clean. {player} keeps the visit going.'
  ],
  multiRed: [
    'Multiple reds fall and {player} opens the table.',
    '{player} with a double red. That is a strong start.',
    'Two reds drop and {player} has options.'
  ],
  colorPot: [
    '{color} goes in for {player}. The cue ball is right in the lane.',
    'Nice color from {player}. That should reset on the spot.',
    '{player} lands the {color}. This break is building.'
  ],
  colorOrder: [
    '{color} disappears in order. {player} clears through the colors.',
    '{player} pots the {color} as the clearance continues.',
    'That is the {color}, and the colors are now in sequence.'
  ],
  respot: [
    '{color} drops and returns to its spot. {player} keeps the rhythm.',
    'Color down and back on its mark. {player} stays on the attack.',
    '{player} slots the {color}; it will be respotted for the next shot.'
  ],
  safety: [
    'A patient safety from {player}. Tucking the cue ball tight.',
    '{player} chooses the safety route. Pressure shifts to {opponent}.',
    'Good containment. {player} leaves {opponent} long and awkward.'
  ],
  snooker: [
    'That is a proper snooker. {opponent} can barely see the ball on.',
    '{player} hides the cue ball. {opponent} is in trouble now.',
    'Excellent snooker. {opponent} will need a clever escape.'
  ],
  freeBall: [
    'Free ball on. {player} can turn this into a big visit.',
    'Free ball opportunity for {player}. That changes the table.',
    '{player} gets the free ball. Expect a tactical swing.'
  ],
  foul: [
    'Foul from {player}. {points} points to {opponent}.',
    '{player} commits a foul, giving {opponent} {points}.',
    'That is a foul: {foulReason}. {opponent} collects {points}.'
  ],
  miss: [
    'That one slides by. {player} misses the pot.',
    'Just off line for {player}. Chance swings to {opponent}.',
    '{player} cannot convert. A look now for {opponent}.'
  ],
  breakBuild: [
    '{player} is building a break of {breakTotal}. Great cueing.',
    'Break at {breakTotal} for {player}. This is real momentum.',
    '{player} is in the groove with {breakTotal} on the run.'
  ],
  century: [
    'That is a century! {player} hits {breakTotal}.',
    '{player} reaches the hundred. A beautiful snooker break.',
    'Century break for {player}. {arena} appreciates the class.'
  ],
  colorsOrder: [
    'Reds are gone. Colors in order from here.',
    'Now into the colors sequence. Every shot is vital.',
    'Colors phase begins. Precision only from here.'
  ],
  frameBall: [
    'This could be frame ball for {player}.',
    'Frame ball moment for {player}. Big pressure shot.',
    '{player} looking at the frame ball. One more clean strike.'
  ],
  frameWin: [
    '{player} takes the frame. Scoreline {scoreline}.',
    'Frame secured by {player}. A composed finish.',
    '{player} closes it out. The frame is theirs.'
  ],
  outro: [
    'That concludes {frameNumber} at {arena}. Thanks for watching.',
    'From {arena}, that is the end of the frame. Great play.',
    'Match coverage wraps here at {arena}. Appreciate you joining us.'
  ],
  turn: [
    'Over to {player} now.',
    '{player} steps in for the next visit.',
    'Next shot belongs to {player}.'
  ]
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

export const buildSnookerCommentaryLine = ({ event, speaker = 'Caster', context = {} }) => {
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker
  };
  const pool = TEMPLATES[EVENT_POOLS[event]] || TEMPLATES.redPot;
  return applyTemplate(pickRandom(pool), mergedContext);
};

export const createSnookerMatchCommentaryScript = ({
  players = { A: 'Player A', B: 'Player B' },
  commentators = ['Caster'],
  scoreline = 'level'
} = {}) => {
  const context = {
    player: players.A,
    opponent: players.B,
    scoreline
  };
  const speaker = commentators[0] || 'Caster';
  return [
    {
      speaker,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.intro,
        speaker,
        context
      })
    },
    {
      speaker,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.outro,
        speaker,
        context
      })
    }
  ];
};

export const SNOOKER_ROYAL_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

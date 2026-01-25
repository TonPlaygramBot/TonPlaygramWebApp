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
  introReply: 'introReply',
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
  outroReply: 'outroReply',
  turn: 'turn'
});

const TEMPLATES = Object.freeze({
  intro: [
    'Welcome to {arena}. {player} and {opponent} are set for {frameNumber}.',
    'We are live at {arena}. {player} versus {opponent}, and the table is ready.',
    'Good evening from {arena}. {player} and {opponent} prepare to open {frameNumber}.',
    'It is match time at {arena}. {player} takes on {opponent} in {frameNumber}.',
    'Hello from {arena}. The clash is {player} against {opponent} in {frameNumber}.'
  ],
  introReply: [
    'The atmosphere is buzzing and the table looks perfect.',
    'Everything is set for a sharp tactical frame.',
    'Plenty of intrigue in this matchup. Let us see who settles first.',
    'Great to be with you as these two start their battle.'
  ],
  breakOff: [
    'Here comes the break-off from {player}. All about control and the baulk line.',
    '{player} to break the pack. The cue ball needs to stay safe in baulk.',
    '{player} steps in for the opener. Gentle break, heavy on precision.',
    '{player} with the opening strike, looking for a tight safety.',
    'Break-off time for {player}. Cue ball control is everything.'
  ],
  redPot: [
    'Red down for {player}. The break is alive.',
    '{player} drops a red and stays in position.',
    'That red is clean. {player} keeps the visit going.',
    '{player} sinks the red and keeps the cue ball close.',
    'Solid red pot by {player}. This visit continues.'
  ],
  multiRed: [
    'Multiple reds fall and {player} opens the table.',
    '{player} with a double red. That is a strong start.',
    'Two reds drop and {player} has options.',
    '{player} clears more than one red and spreads the pack nicely.',
    'A flurry of reds for {player}. The table is loosening up.'
  ],
  colorPot: [
    '{color} goes in for {player}. The cue ball is right in the lane.',
    'Nice color from {player}. That should reset on the spot.',
    '{player} lands the {color}. This break is building.',
    'Smooth on the {color}. {player} keeps the scoring touch.',
    '{player} pockets the {color} and stays in control.'
  ],
  colorOrder: [
    '{color} disappears in order. {player} clears through the colors.',
    '{player} pots the {color} as the clearance continues.',
    'That is the {color}, and the colors are now in sequence.',
    '{player} ticks off the {color} with the clearance still alive.',
    'Sequence shot on the {color}. {player} stays in rhythm.'
  ],
  respot: [
    '{color} drops and returns to its spot. {player} keeps the rhythm.',
    'Color down and back on its mark. {player} stays on the attack.',
    '{player} slots the {color}; it will be respotted for the next shot.',
    '{player} takes the {color} cleanly. It goes back to the spot.',
    'Great on the {color}. Respotted and the break continues.'
  ],
  safety: [
    'A patient safety from {player}. Tucking the cue ball tight.',
    '{player} chooses the safety route. Pressure shifts to {opponent}.',
    'Good containment. {player} leaves {opponent} long and awkward.',
    '{player} rolls in the safety. {opponent} has work to do.',
    '{player} nudges it safe. Tough angle for {opponent} now.'
  ],
  snooker: [
    'That is a proper snooker. {opponent} can barely see the ball on.',
    '{player} hides the cue ball. {opponent} is in trouble now.',
    'Excellent snooker. {opponent} will need a clever escape.',
    '{player} leaves {opponent} snookered. A big tactical moment.',
    'Severe snooker laid by {player}. {opponent} is boxed in.'
  ],
  freeBall: [
    'Free ball on. {player} can turn this into a big visit.',
    'Free ball opportunity for {player}. That changes the table.',
    '{player} gets the free ball. Expect a tactical swing.',
    'Free ball called. {player} can punish from here.',
    'With a free ball, {player} has a golden opening.'
  ],
  foul: [
    'Foul from {player}. {points} points to {opponent}.',
    '{player} commits a foul, giving {opponent} {points}.',
    'That is a foul: {foulReason}. {opponent} collects {points}.',
    'Foul called on {player}. {opponent} takes {points}.',
    'That will cost {player}. {points} to {opponent}.'
  ],
  miss: [
    'That one slides by. {player} misses the pot.',
    'Just off line for {player}. Chance swings to {opponent}.',
    '{player} cannot convert. A look now for {opponent}.',
    'A miss from {player}. {opponent} is back to the table.',
    '{player} just misses. That opens a door for {opponent}.'
  ],
  breakBuild: [
    '{player} is building a break of {breakTotal}. Great cueing.',
    'Break at {breakTotal} for {player}. This is real momentum.',
    '{player} is in the groove with {breakTotal} on the run.',
    '{player} moves to {breakTotal}. Composed and confident.',
    '{breakTotal} on the board for {player}. This is a tidy visit.'
  ],
  century: [
    'That is a century! {player} hits {breakTotal}.',
    '{player} reaches the hundred. A beautiful snooker break.',
    'Century break for {player}. {arena} appreciates the class.',
    '{player} posts a century. That is elite control.',
    'One hundred for {player}. The crowd loves it.'
  ],
  colorsOrder: [
    'Reds are gone. Colors in order from here.',
    'Now into the colors sequence. Every shot is vital.',
    'Colors phase begins. Precision only from here.',
    'We are down to the colors. One by one from here.',
    'Only the colors remain. This is where frames are won.'
  ],
  frameBall: [
    'This could be frame ball for {player}.',
    'Frame ball moment for {player}. Big pressure shot.',
    '{player} looking at the frame ball. One more clean strike.',
    'Frame ball on. {player} can close this out.',
    'It is frame ball for {player}. The pressure is real.'
  ],
  frameWin: [
    '{player} takes the frame. Scoreline {scoreline}.',
    'Frame secured by {player}. A composed finish.',
    '{player} closes it out. The frame is theirs.',
    '{player} seals the frame. Score now {scoreline}.',
    'That is the frame to {player}. Big result there.'
  ],
  outro: [
    'That concludes {frameNumber} at {arena}. Thanks for watching.',
    'From {arena}, that is the end of the frame. Great play.',
    'Match coverage wraps here at {arena}. Appreciate you joining us.',
    'That is all for {frameNumber} from {arena}.',
    'We will close it there at {arena}. Thanks for being with us.'
  ],
  outroReply: [
    'A fine display from both players. Until next time.',
    'Great moments throughout that frame. See you again soon.',
    'That was a fantastic battle. Thanks for watching.',
    'Plenty to take from that. We will catch you in the next one.'
  ],
  turn: [
    'Over to {player} now.',
    '{player} steps in for the next visit.',
    'Next shot belongs to {player}.',
    '{player} is back at the table.',
    '{player} now with the chance.'
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
  const lead = commentators[0] || 'Caster';
  const analyst = commentators[1] || lead;
  const start = [
    {
      speaker: lead,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.intro,
        speaker: lead,
        context
      })
    }
  ];
  if (analyst && analyst !== lead) {
    start.push({
      speaker: analyst,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.introReply,
        speaker: analyst,
        context
      })
    });
  }
  const end = [
    {
      speaker: lead,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.outro,
        speaker: lead,
        context
      })
    }
  ];
  if (analyst && analyst !== lead) {
    end.push({
      speaker: analyst,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.outroReply,
        speaker: analyst,
        context
      })
    });
  }
  return { start, end };
};

export const SNOOKER_ROYAL_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

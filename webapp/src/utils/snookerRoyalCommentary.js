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
    '{frameNumber} underway. {player} to break.',
    'Frame starts now. {player} on the break-off.',
    'Opening shot coming up from {player}.',
    '{player} to open this frame.',
    '{player} steps up for the break.'
  ],
  introReply: [
    'Table is set. Early safety expected.',
    'We are live. First visit will set the tone.',
    'Tactical opening here.',
    'First shot is about control.'
  ],
  breakOff: [
    '{player} breaks off, looking to keep it safe.',
    'Break-off from {player}. Cue ball to baulk.',
    '{player} opens with a controlled break.',
    '{player} sends the cue ball into baulk.',
    'Measured break from {player}.'
  ],
  redPot: [
    'Red down. {player} stays at the table.',
    '{player} pots a red and holds position.',
    'Clean red for {player}.',
    '{player} drops the red. Good cue ball.',
    'Red potted by {player}. Visit continues.'
  ],
  multiRed: [
    'Multiple reds fall. {player} opens the pack.',
    'Two reds down for {player}.',
    '{player} splits reds and stays in.',
    'Reds open up. {player} stays in control.',
    'A pair of reds for {player}.'
  ],
  colorPot: [
    '{color} potted by {player}.',
    '{player} lands the {color}.',
    'Color down. {player} keeps the break.',
    '{player} takes the {color} clean.',
    '{color} in. {player} stays in position.'
  ],
  colorOrder: [
    '{color} taken in order by {player}.',
    '{player} clears the {color}.',
    'That is the {color}. Clearance continues.',
    '{player} ticks off the {color}.',
    'Sequence shot on the {color}.'
  ],
  respot: [
    '{color} down and respotted.',
    '{player} pots the {color}. It returns to the spot.',
    'Color potted. Back on the mark.',
    '{color} drops and is re-spotted.',
    '{player} takes the {color}. Respotted.'
  ],
  safety: [
    '{player} lays a safety.',
    'Safety from {player}. {opponent} back to work.',
    '{player} tucks the cue ball safe.',
    'Containment shot from {player}.',
    '{player} nudges it safe.'
  ],
  snooker: [
    '{player} leaves {opponent} snookered.',
    'Tight snooker. {opponent} has a tough escape.',
    '{player} hides the cue ball. Snooker on.',
    'Excellent snooker from {player}.',
    '{opponent} is forced to kick at it.'
  ],
  freeBall: [
    'Free ball called. {player} to take it.',
    '{player} has a free ball chance.',
    'Free ball on. {player} can build here.',
    'Free ball opportunity for {player}.',
    '{player} with the free ball option.'
  ],
  foul: [
    'Foul. {points} to {opponent}.',
    '{player} fouls. {opponent} gains {points}.',
    'Foul: {foulReason}. {points} to {opponent}.',
    '{points} points to {opponent} after the foul.',
    'Foul against {player}. {opponent} scores {points}.'
  ],
  miss: [
    '{player} misses. Chance for {opponent}.',
    'Missed pot. {opponent} comes in.',
    '{player} overcuts. {opponent} to the table.',
    'Just off for {player}.',
    '{player} fails to convert.'
  ],
  breakBuild: [
    '{player} moves to {breakTotal}.',
    'Break at {breakTotal} for {player}.',
    '{breakTotal} on the visit for {player}.',
    '{player} reaches {breakTotal}.',
    '{player} builds to {breakTotal}.'
  ],
  century: [
    'Century break. {player} hits {breakTotal}.',
    '{player} reaches one hundred.',
    'Hundred up for {player}.',
    '{player} posts {breakTotal}. Century confirmed.',
    'Century for {player}.'
  ],
  colorsOrder: [
    'Reds gone. Colors in sequence.',
    'Into the colors now.',
    'Colors phase starts.',
    'Only the colors remain.',
    'Colors in order from here.'
  ],
  frameBall: [
    'Frame ball for {player}.',
    '{player} on the frame ball.',
    'Frame ball chance here.',
    '{player} can close the frame.',
    'Frame ball on.'
  ],
  frameWin: [
    '{player} wins the frame. {scoreline}.',
    'Frame secured by {player}.',
    '{player} closes it out. {scoreline}.',
    'Frame to {player}.',
    '{player} takes it. {scoreline}.'
  ],
  outro: [
    '{frameNumber} ends. Score {scoreline}.',
    'Frame over. Score {scoreline}.',
    'End of the frame. {scoreline}.',
    '{frameNumber} complete. {scoreline}.',
    'That is the frame. {scoreline}.'
  ],
  outroReply: [
    'Next frame setup underway.',
    'Resetting for the next frame.',
    'Players reset for the next visit.',
    'Re-rack and reset.',
    'Ready to go again.'
  ],
  turn: [
    '{player} to play.',
    'Turn to {player}.',
    '{player} at the table.',
    '{player} to the shot.',
    '{player} in for the next visit.'
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

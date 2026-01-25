const SPEAKER_PROFILES = Object.freeze({
  Steven: {
    id: 'steven',
    name: 'Steven',
    style: 'Play-by-play'
  },
  John: {
    id: 'john',
    name: 'John',
    style: 'Color analyst'
  }
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  targetBall: 'the object ball',
  pocket: 'the corner pocket',
  table: 'the main table',
  arena: 'Pool Royale arena',
  breakType: 'thunder break',
  scoreline: 'level',
  rackNumber: 'this rack'
});

const TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}! I am {speaker}, alongside {partner} for {rackNumber}.',
      'It is match time at {arena}. {speaker} here with {partner}, and we are set for {variantName}.',
      'Good evening from {arena}. {speaker} with {partner}, and the balls are ready for {variantName}.'
    ],
    introReply: [
      'Thanks {speaker}. The table is tight and the pressure is real in {variantName}.',
      'Great to be here, {speaker}. Expect a tactical battle in {variantName}.',
      'Absolutely, {speaker}. This is the kind of arena where every inch of position matters.'
    ],
    breakShot: [
      '{player} steps in for the break—eyes on the head ball and the wing balls.',
      '{player} leaning in. A clean break could open {table} wide.',
      'Here comes the break from {player}. Watch the cue ball for control.'
    ],
    breakResult: [
      'Nice spread off the break; the rack is open now.',
      'That break has cracked the pack—plenty of lanes available.',
      'Solid pop on the break. Control on the cue ball is the key.'
    ],
    openTable: [
      'Early pattern here—{player} wants to take the natural angles.',
      'Plenty of options with the open table; cue ball path is everything.',
      '{player} is reading the table, looking for a simple route.'
    ],
    safety: [
      'A smart safety. {player} tucks the cue ball behind a blocker.',
      'That is a measured safety, leaving {opponent} long and awkward.',
      '{player} turns down the pot and plays the safety battle.'
    ],
    pressure: [
      'Big moment. {player} needs this pot to keep the run alive.',
      'Pressure shot here for {player}; it is all about a soft touch.',
      'This is where nerves show—{player} has to deliver.'
    ],
    pot: [
      'Beautiful pot. {player} stays right on line for the next ball.',
      'Clean strike from {player}. That is textbook cueing.',
      '{player} drops it in and holds the cue ball in the lane.'
    ],
    combo: [
      'That is a clever combination—using the {targetBall} to open the {pocket}.',
      'What a combo! {player} turns a tough angle into a makeable shot.',
      'Great combination play. {player} sees the carom and takes it.'
    ],
    bank: [
      '{player} goes to the cushion—bank shot, perfectly judged.',
      'Bold bank from {player}, and it lands in the heart of the {pocket}.',
      'Bank shot called and made. That is confidence.'
    ],
    kick: [
      'Kick shot required—{player} goes one rail to find it.',
      'Tough kick for {player}; cue ball needs to hit thin.',
      '{player} escapes with a kick. Excellent table awareness.'
    ],
    jump: [
      'Jump cue out—{player} goes airborne to clear the blocker.',
      'That is a confident jump shot from {player}.',
      'Jump shot executed; {player} gets the hit and stays in control.'
    ],
    miss: [
      'Oh, that one drifts offline. {player} misses the pocket.',
      'It slides past. {player} will be disappointed with that miss.',
      'A rare miss from {player}, and now {opponent} has a look.'
    ],
    foul: [
      'Foul called. That gives {opponent} a major opportunity.',
      'That is a foul, and it flips the table in favor of {opponent}.',
      'Unfortunate foul there; {opponent} will have ball in hand.'
    ],
    inHand: [
      '{opponent} takes ball in hand and can lay it exactly where they want.',
      'Ball in hand for {opponent}; the table is now theirs to map.',
      '{opponent} will place the cue ball with surgical precision.'
    ],
    runout: [
      '{player} is in rhythm—this could be a full clearance.',
      'A runout is on. {player} just needs clean angles.',
      '{player} is stitching it together, ball by ball.'
    ],
    hillHill: [
      'We are at hill-hill. This is as tense as it gets.',
      'Decider time. One rack for everything.',
      'Final rack nerves—every shot feels heavier now.'
    ],
    frameWin: [
      '{player} closes the rack. That is clinical pool.',
      'Rack won by {player}. Clean finish.',
      '{player} finishes it in style and takes the rack.'
    ],
    matchWin: [
      '{player} seals the match—what a performance.',
      'That is the match. {player} comes through under pressure.',
      '{player} wins it, and {arena} appreciates a professional display.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. Great match tonight.',
      'A fantastic finish in {variantName}. Thanks for watching.'
    ]
  },
  nineBall: {
    variantName: '9-ball American billiards',
    rotation: [
      'Rotation play means {player} must strike the lowest ball first.',
      'Nine-ball demands precision on the lowest ball every time.',
      'Lowest ball on first—classic nine-ball discipline.'
    ],
    goldenBreak: [
      'A golden break would end it instantly if the nine drops.',
      'Keep an eye on the nine—golden break possibilities here.',
      'If the nine falls on the snap, it is over.'
    ],
    comboNine: [
      '{player} is eyeing the combo into the nine—dangerous shot.',
      'That is a combo on the nine. Big swing if it goes.',
      'Nine-ball combo chance for {player}. This could finish the rack.'
    ],
    pushOut: [
      '{player} uses the push-out to gain a better look.',
      'Strategic push-out here, forcing a tough decision.',
      'Push-out played—now {opponent} must decide to shoot or pass.'
    ]
  },
  eightBallUk: {
    variantName: '8-ball UK',
    groupCall: [
      '{player} is on {group}, and that changes the pattern immediately.',
      '{player} is taking {group}; the layout opens for a run.',
      '{player} chooses {group}, so the route is clear to the black.'
    ],
    freeBall: [
      'Foul gives {player} a free ball—huge advantage in UK rules.',
      'That is a free ball for {player}; they can use it tactically.',
      'UK rules apply: free ball and two visits for {player}.'
    ],
    blackBall: [
      'The black is in play now. This is the money ball.',
      'Everything goes through the black from here.',
      'Black ball time—perfect angle required.'
    ]
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  breakShot: 'breakShot',
  breakResult: 'breakResult',
  openTable: 'openTable',
  safety: 'safety',
  pressure: 'pressure',
  pot: 'pot',
  combo: 'combo',
  bank: 'bank',
  kick: 'kick',
  jump: 'jump',
  miss: 'miss',
  foul: 'foul',
  inHand: 'inHand',
  runout: 'runout',
  hillHill: 'hillHill',
  frameWin: 'frameWin',
  matchWin: 'matchWin',
  outro: 'outro',
  rotation: 'rotation',
  goldenBreak: 'goldenBreak',
  comboNine: 'comboNine',
  pushOut: 'pushOut',
  groupCall: 'groupCall',
  freeBall: 'freeBall',
  blackBall: 'blackBall'
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

const resolveVariantData = (variantId) => {
  if (variantId === '8ball-uk') return TEMPLATES.eightBallUk;
  return TEMPLATES.nineBall;
};

export const buildCommentaryLine = ({ event, variant = '9ball', speaker = 'Steven', context = {} }) => {
  const resolvedVariant = resolveVariantData(variant);
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === 'Steven' ? 'John' : 'Steven',
    variantName: resolvedVariant.variantName
  };

  const eventPool =
    resolvedVariant[EVENT_POOLS[event]] || TEMPLATES.common[EVENT_POOLS[event]] || TEMPLATES.common.pot;

  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const createMatchCommentaryScript = ({
  variant = '9ball',
  players = { A: 'Player A', B: 'Player B' },
  commentators = ['Steven', 'John'],
  scoreline = 'level'
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.A,
    opponent: players.B,
    scoreline
  };

  const script = [
    { speaker: lead, event: EVENT_POOLS.intro },
    { speaker: analyst, event: EVENT_POOLS.introReply },
    { speaker: lead, event: EVENT_POOLS.breakShot },
    { speaker: analyst, event: EVENT_POOLS.breakResult },
    { speaker: lead, event: EVENT_POOLS.openTable },
    { speaker: analyst, event: EVENT_POOLS.safety },
    { speaker: lead, event: EVENT_POOLS.pot },
    { speaker: analyst, event: EVENT_POOLS.pressure },
    { speaker: lead, event: EVENT_POOLS.runout },
    { speaker: analyst, event: EVENT_POOLS.frameWin },
    { speaker: lead, event: EVENT_POOLS.matchWin },
    { speaker: analyst, event: EVENT_POOLS.outro }
  ];

  const variantScriptExtras =
    variant === '8ball-uk'
      ? [
          { speaker: lead, event: EVENT_POOLS.groupCall, context: { group: 'reds' } },
          { speaker: analyst, event: EVENT_POOLS.freeBall },
          { speaker: lead, event: EVENT_POOLS.blackBall }
        ]
      : [
          { speaker: lead, event: EVENT_POOLS.rotation },
          { speaker: analyst, event: EVENT_POOLS.goldenBreak },
          { speaker: lead, event: EVENT_POOLS.comboNine }
        ];

  const combined = [script[0], script[1], ...variantScriptExtras, ...script.slice(2)];

  return combined.map((entry, index) => {
    const speaker = entry.speaker ?? commentators[index % commentators.length];
    return {
      speaker,
      text: buildCommentaryLine({
        event: entry.event,
        variant,
        speaker,
        context: { ...context, ...(entry.context ?? {}) }
      })
    };
  });
};

export const POOL_ROYALE_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

export const POOL_ROYALE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

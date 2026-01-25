export const POOL_ROYALE_SPEAKERS = Object.freeze({
  lead: 'Mason',
  analyst: 'Lena'
});

const SPEAKER_PROFILES = Object.freeze({
  Mason: {
    id: 'mason',
    name: 'Mason',
    style: 'Play-by-play'
  },
  Lena: {
    id: 'lena',
    name: 'Lena',
    style: 'Color analyst'
  }
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  playerScore: 0,
  opponentScore: 0,
  playerPoints: 0,
  opponentPoints: 0,
  playerPots: 0,
  opponentPots: 0,
  targetBall: 'the object ball',
  pocket: 'the pocket',
  potCount: 0,
  table: 'the main table',
  arena: 'Pool Royale arena',
  breakType: 'thunder break',
  scoreline: 'level at 0-0',
  groupPrimary: 'reds',
  groupSecondary: 'yellows',
  ballSet: 'uk',
  rackNumber: 'this rack'
});

const TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} with {partner}. {player} faces {opponent} with the score {playerScore}-{opponentScore} in {variantName}.',
      'It is match time at {arena}. {speaker} alongside {partner}. {player} versus {opponent}, {scoreline} in {variantName}.',
      'Good evening from {arena}. {speaker} with {partner}. {player} and {opponent} are locked at {playerScore}-{opponentScore}.'
    ],
    introReply: [
      'Thanks {speaker}. Points are precious tonight—every pot will matter for {player} and {opponent}.',
      'Great to be here, {speaker}. The scoreboard reads {playerScore}-{opponentScore}, and the margins are razor thin.',
      'Absolutely, {speaker}. {player} and {opponent} both need clean pots to turn points into control.'
    ],
    breakShot: [
      '{player} steps in for the break; a sharp split sets up early pots.',
      '{player} leans in. A controlled break can define the scoring chances.',
      'Here comes the break from {player}. Cue ball control will be everything.'
    ],
    breakResult: [
      'Nice spread off the break, {speaker}. The rack is open now.',
      'That break has cracked the pack—clean lanes for scoring chances, {speaker}.',
      'Solid pop on the break. Control on the cue ball is the key from here.'
    ],
    openTable: [
      'Early pattern here—{player} wants natural angles and quick pots.',
      'Plenty of options with the open table; cue ball paths decide the points.',
      '{player} is reading the table, looking for a simple route to the next pot.'
    ],
    safety: [
      'A smart safety, {partner}. {player} tucks the cue ball behind a blocker.',
      'That is a measured safety, leaving {opponent} long and awkward.',
      '{player} turns down the pot and plays the safety battle to protect the score.'
    ],
    pressure: [
      'Big moment. {player} needs this pot to keep the scoring run alive.',
      'Pressure shot here for {player}; it is all about soft touch and points.',
      'This is where nerves show—{player} has to deliver for the scoreboard.'
    ],
    pot: [
      '{player} pots {targetBall}.',
      'Pot: {targetBall}.',
      '{player} sends {targetBall} down.'
    ],
    combo: [
      '{player} combos {targetBall}.',
      'Combination pot on {targetBall}.',
      '{player} caroms {targetBall} into the {pocket}.'
    ],
    bank: [
      '{player} banks {targetBall} into the {pocket}.',
      'Bank shot: {targetBall} in the {pocket}.',
      '{player} sends {targetBall} off the cushion and down.'
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
      '{player} misses the pot.',
      'No pot for {player}.',
      '{player} comes up short.'
    ],
    foul: [
      'Foul on {player}.',
      'Foul called. {opponent} to the table.',
      '{player} commits a foul.'
    ],
    inHand: [
      'Ball in hand for {opponent}.',
      '{opponent} has ball in hand.',
      'Cue ball in hand for {opponent}.'
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
      '{player} wins the rack.',
      'Rack to {player}.',
      '{player} closes the rack.'
    ],
    matchWin: [
      'Match over. {player} wins {playerScore}-{opponentScore}.',
      '{player} takes the match, {playerScore}-{opponentScore}.',
      'Final score {playerScore}-{opponentScore}. {player} wins.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us, {partner}.',
      'From {arena}, that is full time. Great match tonight, {partner}.',
      'A fantastic finish in {variantName}. Thanks for watching with us.'
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
  eightBallUs: {
    variantName: '8-ball American pool',
    groupCall: [
      'Open table between {groupPrimary} and {groupSecondary}; {player} is looking to claim one.',
      '{player} can choose {groupPrimary} or {groupSecondary}—the first clean pot decides the pattern.',
      'Plenty of options here, {partner}. {groupPrimary} and {groupSecondary} are both available.'
    ],
    inHand: [
      'Foul gives {opponent} ball in hand—prime time for an 8-ball run.',
      '{opponent} has ball in hand, and that is a big swing in American 8-ball.',
      'Ball in hand now for {opponent}; expect a composed clearance attempt.'
    ],
    eightBall: [
      'The 8-ball is in play now. Position is everything.',
      'Everything moves through the 8-ball from here.',
      'Eight-ball on the table—one mistake decides it.'
    ]
  },
  eightBallUk: {
    variantName: '8-ball UK',
    groupCall: [
      'Open table between {groupPrimary} and {groupSecondary}; {player} will claim a set soon.',
      '{groupPrimary} versus {groupSecondary} in UK rules; the first clean pot sets the route.',
      'UK rules in play, {partner}. {groupPrimary} and {groupSecondary} are both available.'
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
  if (variantId === 'uk' || variantId === '8ball-uk') return TEMPLATES.eightBallUk;
  if (variantId === 'american' || variantId === '8ball-us') return TEMPLATES.eightBallUs;
  return TEMPLATES.nineBall;
};

export const buildCommentaryLine = ({ event, variant = '9ball', speaker = 'Mason', context = {} }) => {
  const resolvedVariant = resolveVariantData(variant);
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === POOL_ROYALE_SPEAKERS.lead
      ? POOL_ROYALE_SPEAKERS.analyst
      : POOL_ROYALE_SPEAKERS.lead,
    variantName: resolvedVariant.variantName
  };

  const eventPool =
    resolvedVariant[EVENT_POOLS[event]] || TEMPLATES.common[EVENT_POOLS[event]] || TEMPLATES.common.pot;

  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const createMatchCommentaryScript = ({
  variant = '9ball',
  ballSet = 'uk',
  players = { A: 'Player A', B: 'Player B' },
  commentators = [POOL_ROYALE_SPEAKERS.lead, POOL_ROYALE_SPEAKERS.analyst],
  scoreline = 'level at 0-0',
  scores = { A: 0, B: 0 },
  pots = { A: 0, B: 0 },
  points = { A: 0, B: 0 }
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.A,
    opponent: players.B,
    scoreline,
    playerScore: scores.A ?? 0,
    opponentScore: scores.B ?? 0,
    playerPoints: points.A ?? scores.A ?? 0,
    opponentPoints: points.B ?? scores.B ?? 0,
    playerPots: pots.A ?? 0,
    opponentPots: pots.B ?? 0,
    ballSet
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

  const groupLabels =
    variant === 'uk'
      ? ballSet === 'american'
        ? { primary: 'solids', secondary: 'stripes' }
        : { primary: 'reds', secondary: 'yellows' }
      : { primary: 'solids', secondary: 'stripes' };

  const variantScriptExtras =
    variant === 'uk'
      ? [
          {
            speaker: lead,
            event: EVENT_POOLS.groupCall,
            context: { groupPrimary: groupLabels.primary, groupSecondary: groupLabels.secondary }
          },
          { speaker: analyst, event: EVENT_POOLS.freeBall },
          { speaker: lead, event: EVENT_POOLS.blackBall }
        ]
      : variant === 'american'
        ? [
            {
              speaker: lead,
              event: EVENT_POOLS.groupCall,
              context: { groupPrimary: groupLabels.primary, groupSecondary: groupLabels.secondary }
            },
            { speaker: analyst, event: EVENT_POOLS.inHand },
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

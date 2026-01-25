const VARIANT_LABELS = {
  american: 'American 8-ball',
  uk: 'UK 8-ball',
  '9ball': '9-ball'
};

const COMMENTATORS = ['Steven', 'John'];

const pick = (items) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  const index = Math.floor(Math.random() * items.length);
  return items[Math.max(0, Math.min(index, items.length - 1))] || '';
};

const formatTemplate = (template, tokens) =>
  template.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? '');

const formatBallLabel = (ballId, variantId) => {
  if (!ballId) return 'ball';
  const upper = String(ballId).toUpperCase();
  if (upper.startsWith('BALL_')) {
    const num = Number.parseInt(upper.replace('BALL_', ''), 10);
    if (Number.isFinite(num)) {
      if (num === 8) return variantId === 'uk' ? 'the black' : 'the 8-ball';
      return `the ${num}-ball`;
    }
  }
  if (upper === 'CUE') return 'the cue ball';
  if (upper === 'BLACK') return variantId === 'uk' ? 'the black' : 'the 8-ball';
  if (upper === 'RED') return 'the red';
  if (upper === 'YELLOW') return 'the yellow';
  if (upper === 'BLUE') return 'the blue';
  if (upper === 'GREEN') return 'the green';
  if (upper === 'BROWN') return 'the brown';
  if (upper === 'PINK') return 'the pink';
  if (upper === 'STRIPE') return 'a stripe';
  if (upper === 'SOLID') return 'a solid';
  return `the ${upper.toLowerCase()}`;
};

const formatBallList = (balls, variantId) => {
  if (!Array.isArray(balls) || balls.length === 0) return '';
  const labels = balls.map((ball) => formatBallLabel(ball, variantId));
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
};

const INTRO_STEVEN = [
  'Welcome to Pool Royale, {variant}. The arena is set and the lights are bright.',
  'Good evening from Pool Royale. It is time for {variant}, and this table is pristine.',
  'Hello and welcome to Pool Royale. We are ready for {variant} under the lights.'
];

const INTRO_JOHN = [
  'Steven, we have {playerA} against {playerB}, and the break is moments away.',
  'Two strong players tonight: {playerA} versus {playerB}. This should be a tactical battle.',
  'It is {playerA} and {playerB} at the table. We expect disciplined cue ball control.'
];

const BREAK_LINES = [
  'That is a firm break, plenty of spread across the table.',
  'Cracking break shot, the rack opens nicely.',
  'Good power on the break, balls are moving and the table is alive.'
];

const POT_LINES = [
  '{player} guides {ball} cleanly into the pocket.',
  'Lovely touch from {player}, {ball} drops.',
  '{player} strokes {ball} in with confidence.',
  'That is textbook potting: {ball} disappears for {player}.',
  '{player} stays composed and sinks {ball}.'
];

const MULTI_POT_LINES = [
  '{player} pockets {balls}; that is a productive visit.',
  'Two or more down for {player} with {balls} falling.',
  '{player} clears a cluster, {balls} are gone.'
];

const SAFETY_LINES = [
  '{player} chooses the safety, leaving the cue ball tight to the cushion.',
  'That is a clever containing shot from {player}, nothing easy on.',
  '{player} plays the percentage safety, keeping control of the cue ball.'
];

const MISS_LINES = [
  '{player} just misses the pot and leaves a tester.',
  'Not quite there for {player}; the cue ball drifts out of position.',
  '{player} overruns it slightly, and the table opens for the opponent.'
];

const FOUL_LINES = [
  'That is a foul from {player}; the cue ball has scratched.',
  'Foul called on {player}, contact did not meet the rules.',
  '{player} commits a foul, and the opponent will have ball in hand.',
  'Unlucky there for {player}, that is a foul and a big swing.'
];

const IN_HAND_LINES = [
  'Ball in hand now, a huge chance to build a run.',
  'With ball in hand, this is a golden opening.',
  'Ball in hand changes the table completely; control is key.'
];

const TURN_LINES = [
  '{player} stays at the table and keeps the initiative.',
  '{player} remains in control, another shot coming.',
  '{player} will continue the visit with the table to run.'
];

const SWING_LINES = [
  'Turnover here, and {player} will get the chance.',
  'That brings the opponent to the table: {player} to play.',
  '{player} is invited in with an opening.'
];

const FRAME_WIN_LINES = [
  '{winner} closes it out and wins the rack.',
  'That seals the frame for {winner}.',
  '{winner} finishes in style and takes the game.'
];

const FRAME_TIE_LINES = [
  'It ends level; no separating these two in this frame.',
  'A dead heat at the end of that rack, we will need a decider.',
  'They are tied after that frame; it could not be closer.'
];

const FRAME_WRAP_LINES = [
  'Steven, that was high-quality pool all the way through.',
  'A smart mix of potting and safety play, exactly what we expect at this level.',
  'Cue ball control was the difference maker there.'
];

export const createPoolRoyaleCommentary = ({ variantId, playerNames }) => {
  let speakerIndex = 0;
  const nextSpeaker = () => {
    const speaker = COMMENTATORS[speakerIndex % COMMENTATORS.length];
    speakerIndex += 1;
    return speaker;
  };

  const buildLine = (templates, tokens, speakerOverride) => {
    const template = pick(templates);
    const speaker = speakerOverride || nextSpeaker();
    const text = formatTemplate(template, tokens);
    return { speaker, text: `${speaker}: ${text}` };
  };

  const reset = () => {
    speakerIndex = 0;
  };

  const variantLabel = VARIANT_LABELS[variantId] || 'pool';

  const getMatchStartLines = () => [
    buildLine(INTRO_STEVEN, {
      variant: variantLabel,
      playerA: playerNames?.A ?? 'Player A',
      playerB: playerNames?.B ?? 'Player B'
    }, 'Steven'),
    buildLine(INTRO_JOHN, {
      variant: variantLabel,
      playerA: playerNames?.A ?? 'Player A',
      playerB: playerNames?.B ?? 'Player B'
    }, 'John')
  ];

  const getBreakLine = () =>
    buildLine(BREAK_LINES, {
      variant: variantLabel
    });

  const getShotLine = ({
    player,
    pottedBalls,
    isFoul,
    isSafety,
    isBreakShot
  }) => {
    if (isBreakShot) {
      return getBreakLine();
    }

    if (isFoul) {
      return buildLine(FOUL_LINES, { player });
    }

    if (pottedBalls?.length > 1) {
      return buildLine(MULTI_POT_LINES, {
        player,
        balls: formatBallList(pottedBalls, variantId)
      });
    }

    if (pottedBalls?.length === 1) {
      return buildLine(POT_LINES, {
        player,
        ball: formatBallList(pottedBalls, variantId)
      });
    }

    if (isSafety) {
      return buildLine(SAFETY_LINES, { player });
    }

    return buildLine(MISS_LINES, { player });
  };

  const getBallInHandLine = () => buildLine(IN_HAND_LINES, {});

  const getTurnLine = (player) => buildLine(TURN_LINES, { player });

  const getSwingLine = (player) => buildLine(SWING_LINES, { player });

  const getFrameEndLines = ({ winner, isTie }) => {
    if (isTie) {
      return [buildLine(FRAME_TIE_LINES, {}), buildLine(FRAME_WRAP_LINES, {})];
    }
    return [
      buildLine(FRAME_WIN_LINES, { winner }),
      buildLine(FRAME_WRAP_LINES, {})
    ];
  };

  return {
    reset,
    getMatchStartLines,
    getShotLine,
    getBallInHandLine,
    getTurnLine,
    getSwingLine,
    getFrameEndLines,
    formatBallLabel
  };
};

export const resolveCommentaryBallLabel = formatBallLabel;

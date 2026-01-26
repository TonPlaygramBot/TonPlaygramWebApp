export const CHESS_BATTLE_SPEAKERS = Object.freeze({
  lead: 'Victor',
  analyst: 'Elena'
});

const SPEAKER_PROFILES = Object.freeze({
  Victor: {
    id: 'victor',
    name: 'Victor',
    style: 'Play-by-play'
  },
  Elena: {
    id: 'elena',
    name: 'Elena',
    style: 'Color analyst'
  }
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'White',
  opponent: 'Black',
  arena: 'Chess Battle Royal arena',
  scoreline: 'all square',
  piece: 'piece',
  fromSquare: 'the starting square',
  toSquare: 'the target square',
  capturedPiece: 'piece',
  castleSide: 'king-side',
  winner: 'White'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} with you as {player} takes on {opponent}.',
      'Live from {arena}, {speaker} on the call. {player} versus {opponent} is underway.',
      'Good evening from {arena}. {speaker} here for {player} against {opponent}.'
    ],
    introReply: [
      'Thanks {speaker}. Expect precise calculation and patient maneuvering from both sides.',
      'Great to be here, {speaker}. This one should be decided by central control and king safety.',
      'Absolutely, {speaker}. It is a battle of plans—structure, tempo, and tactics.'
    ],
    opening: [
      '{player} is staking early central control with {piece} to {toSquare}.',
      'Opening phase here—{player} develops with {piece} to {toSquare}.',
      '{player} keeps it principled, putting {piece} on {toSquare}.'
    ],
    move: [
      'A calm improving move: {player} plays {piece} to {toSquare}.',
      '{player} repositions the {piece} to {toSquare}, keeping the structure intact.',
      '{player} chooses {piece} to {toSquare}, a measured positional step.'
    ],
    capture: [
      '{player} captures on {toSquare}, taking the {capturedPiece}.',
      'Exchange on {toSquare}—{player} removes the {capturedPiece}.',
      '{player} goes tactical, {piece} captures the {capturedPiece} on {toSquare}.'
    ],
    check: [
      'Check on the board—{player} forces the king to respond.',
      '{player} delivers check, tightening the net.',
      'That is check; {opponent} must find a precise reply.'
    ],
    checkmate: [
      'Checkmate. {winner} seals the result.',
      'That is mate—{winner} finishes it clinically.',
      'Checkmate on the board. {winner} takes the game.'
    ],
    stalemate: [
      'Stalemate. No legal moves, and the game is drawn.',
      'It is stalemate—nothing available for the side to move.',
      'Draw by stalemate. The position is locked.'
    ],
    promotion: [
      'Promotion on {toSquare}; {player} has a new queen.',
      '{player} promotes on {toSquare}, a decisive upgrade.',
      'Pawn promotion arrives for {player} on {toSquare}.'
    ],
    castle: [
      '{player} castles {castleSide}, tucking the king to safety.',
      'Castling {castleSide} for {player}; king safety first.',
      '{player} completes {castleSide} castling, activating the rook.'
    ],
    endgame: [
      'We are in the endgame now—every tempo matters.',
      'Endgame phase: piece activity and king placement are critical.',
      'The endgame is here; precision will decide it.'
    ],
    outro: [
      'That concludes the clash from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. Appreciate your company.',
      'A fine finish here at {arena}. Thanks for watching.'
    ]
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  opening: 'opening',
  move: 'move',
  capture: 'capture',
  check: 'check',
  checkmate: 'checkmate',
  stalemate: 'stalemate',
  promotion: 'promotion',
  castle: 'castle',
  endgame: 'endgame',
  outro: 'outro'
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

const resolveLanguageKey = (language = 'en') => {
  const normalized = String(language || '').toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return 'en';
};

export const buildChessCommentaryLine = ({
  event,
  speaker = CHESS_BATTLE_SPEAKERS.lead,
  language = 'en',
  context = {}
}) => {
  const templates = resolveLanguageKey(language) === 'en' ? ENGLISH_TEMPLATES : ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === CHESS_BATTLE_SPEAKERS.lead
      ? CHESS_BATTLE_SPEAKERS.analyst
      : CHESS_BATTLE_SPEAKERS.lead
  };
  const eventPool = templates.common[EVENT_POOLS[event]] || templates.common.move;
  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const createChessMatchCommentaryScript = ({
  players = { white: 'White', black: 'Black' },
  commentators = [CHESS_BATTLE_SPEAKERS.lead, CHESS_BATTLE_SPEAKERS.analyst],
  language = 'en',
  arena = 'Chess Battle Royal arena'
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.white,
    opponent: players.black,
    arena
  };

  const script = [
    { speaker: lead, event: EVENT_POOLS.intro },
    { speaker: analyst, event: EVENT_POOLS.introReply },
    { speaker: lead, event: EVENT_POOLS.opening }
  ];

  return script.map((entry) => ({
    speaker: entry.speaker,
    text: buildChessCommentaryLine({
      event: entry.event,
      speaker: entry.speaker,
      language,
      context
    })
  }));
};

export const CHESS_BATTLE_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

export const CHESS_BATTLE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

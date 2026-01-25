export const CHESS_BATTLE_SPEAKERS = Object.freeze({
  lead: 'Adrian',
  analyst: 'Sofia'
});

const SPEAKER_PROFILES = Object.freeze({
  Adrian: {
    id: 'adrian',
    name: 'Adrian',
    style: 'Play-by-play'
  },
  Sofia: {
    id: 'sofia',
    name: 'Sofia',
    style: 'Color analyst'
  }
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'White',
  opponent: 'Black',
  playerColor: 'White',
  opponentColor: 'Black',
  piece: 'piece',
  capturedPiece: 'piece',
  fromSquare: 'e2',
  toSquare: 'e4',
  moveNumber: 1,
  arena: 'Chess Battle Royal Arena',
  phase: 'opening'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} alongside {partner}. {player} has White, {opponent} the Black pieces.',
      'We are live from {arena}. {player} takes White against {opponent} in a high-stakes battle chess duel.',
      'Good evening from {arena}. {speaker} here with {partner}—{player} versus {opponent} on the chessboard.'
    ],
    introReply: [
      'Thanks, {speaker}. Expect a sharp opening and precise calculation; one slip can flip the entire game.',
      'Glad to be here, {speaker}. The tempo and piece coordination will decide who controls the center.',
      'Absolutely, {speaker}. This will be about discipline and timing—every pawn push has a story.'
    ],
    opening: [
      'Early moves are about claiming space and developing with purpose.',
      '{player} starts to steer the opening, looking for harmonious piece placement.',
      'We are in the opening phase—central control and king safety are the priorities.'
    ],
    move: [
      '{playerColor} plays {piece} from {fromSquare} to {toSquare}, keeping the position steady.',
      '{player} advances {piece} to {toSquare}; a measured improvement move.',
      '{piece} to {toSquare}. {player} is building a calm, flexible setup.'
    ],
    capture: [
      '{player} captures on {toSquare}, removing the {capturedPiece}.',
      '{piece} takes on {toSquare}; {player} wins material cleanly.',
      '{playerColor} trades on {toSquare} with the {piece}, simplifying the position.'
    ],
    castle: [
      '{playerColor} castles, tucking the king away and connecting the rooks.',
      'Castling from {player}—king safety secured and the rook is activated.',
      '{playerColor} chooses to castle; the position now looks solid and coordinated.'
    ],
    promotion: [
      'Promotion! {player} turns that pawn into a new queen—huge swing in power.',
      '{playerColor} promotes on {toSquare}; a fresh queen joins the attack.',
      'A pawn reaches the end and promotes—{player} gains decisive material.'
    ],
    check: [
      'Check! {player} puts the king under pressure with that move.',
      '{playerColor} gives check—{opponent} must respond precisely.',
      'The king is in check; {player} has seized the initiative.'
    ],
    checkmate: [
      'Checkmate! {player} seals the game with a clinical finish.',
      'That is mate. {player} converts with authority.',
      'Checkmate delivered—{player} wins in commanding style.'
    ],
    stalemate: [
      'Stalemate—no legal moves. The game ends in a draw.',
      'Stalemate on the board; a hard-fought draw is confirmed.',
      'No legal moves and no check—stalemate brings the battle to a draw.'
    ],
    endgame: [
      'We are in the endgame now—every tempo matters.',
      'Endgame phase: king activity and pawn structure are critical.',
      'The position has simplified; this is pure endgame technique.'
    ]
  }
});

const COMMENTARY_EVENTS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  opening: 'opening',
  move: 'move',
  capture: 'capture',
  castle: 'castle',
  promotion: 'promotion',
  check: 'check',
  checkmate: 'checkmate',
  stalemate: 'stalemate',
  endgame: 'endgame'
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

export const buildChessBattleCommentaryLine = ({
  event,
  speaker = CHESS_BATTLE_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const templates = ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === CHESS_BATTLE_SPEAKERS.lead
      ? CHESS_BATTLE_SPEAKERS.analyst
      : CHESS_BATTLE_SPEAKERS.lead
  };
  const eventPool = templates.common[COMMENTARY_EVENTS[event]] || templates.common.move;
  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const createChessMatchCommentaryScript = ({
  players = { white: 'White', black: 'Black' },
  commentators = [CHESS_BATTLE_SPEAKERS.lead, CHESS_BATTLE_SPEAKERS.analyst],
  language = 'en',
  arena = DEFAULT_CONTEXT.arena
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.white,
    opponent: players.black,
    playerColor: 'White',
    opponentColor: 'Black',
    arena
  };
  const script = [
    { speaker: lead, event: COMMENTARY_EVENTS.intro },
    { speaker: analyst, event: COMMENTARY_EVENTS.introReply },
    { speaker: lead, event: COMMENTARY_EVENTS.opening }
  ];
  return script.map((entry) => ({
    speaker: entry.speaker,
    text: buildChessBattleCommentaryLine({
      event: entry.event,
      speaker: entry.speaker,
      language,
      context
    })
  }));
};

export const CHESS_BATTLE_COMMENTARY_EVENTS = Object.freeze({
  ...COMMENTARY_EVENTS
});

export const CHESS_BATTLE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

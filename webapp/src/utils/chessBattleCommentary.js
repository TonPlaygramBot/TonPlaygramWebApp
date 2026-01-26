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

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['欢迎来到{arena}。{speaker}为您解说，{player}对阵{opponent}。'],
      introReply: ['谢谢{speaker}。精准计算与耐心布局将决定胜负。'],
      opening: ['{player}以{piece}走到{toSquare}，展开开局。'],
      move: ['{player}将{piece}走到{toSquare}，稳健推进。'],
      capture: ['{player}在{toSquare}吃掉{capturedPiece}。'],
      check: ['将军！{opponent}必须应对。'],
      checkmate: ['将杀！{winner}锁定胜局。'],
      stalemate: ['僵局，无子可走，棋局和棋。'],
      promotion: ['{player}在{toSquare}升变。'],
      castle: ['{player}在{castleSide}侧王车易位，国王安全。'],
      endgame: ['进入残局，细节决定成败。'],
      outro: ['来自{arena}的比赛结束，感谢观看。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['{arena} से स्वागत है। {speaker} के साथ {player} बनाम {opponent}।'],
      introReply: ['धन्यवाद {speaker}. सटीक गणना और धैर्यपूर्ण चालें निर्णायक होंगी।'],
      opening: ['{player} {piece} को {toSquare} पर विकसित करता है।'],
      move: ['{player} {piece} को {toSquare} पर ले जाता है।'],
      capture: ['{player} ने {toSquare} पर {capturedPiece} लिया।'],
      check: ['चेक! {opponent} को जवाब देना होगा।'],
      checkmate: ['चेकमेट! {winner} जीत गया।'],
      stalemate: ['स्टेलमेट—कोई वैध चाल नहीं, खेल ड्रॉ।'],
      promotion: ['{player} {toSquare} पर प्रोमोशन करता है।'],
      castle: ['{player} {castleSide} कैसल करता है, राजा सुरक्षित।'],
      endgame: ['एंडगेम में हम हैं—हर टेम्पो अहम है।'],
      outro: ['{arena} से बस इतना ही, धन्यवाद।']
    }
  },
  ru: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Добро пожаловать на {arena}. {speaker} в эфире: {player} против {opponent}.'],
      introReply: ['Спасибо, {speaker}. Точный расчёт и терпеливое маневрирование решат исход.'],
      opening: ['{player} развивает {piece} на {toSquare}.'],
      move: ['{player} переводит {piece} на {toSquare}.'],
      capture: ['{player} берет {capturedPiece} на {toSquare}.'],
      check: ['Шах! {opponent} должен отвечать.'],
      checkmate: ['Мат. {winner} завершает партию.'],
      stalemate: ['Пат — ходов нет, ничья.'],
      promotion: ['{player} делает превращение на {toSquare}.'],
      castle: ['{player} рокирует на {castleSide}, король в безопасности.'],
      endgame: ['Эндшпиль: точность решает всё.'],
      outro: ['Из {arena} — спасибо за просмотр.']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenidos a {arena}. {speaker} con ustedes: {player} contra {opponent}.'],
      introReply: ['Gracias {speaker}. Cálculo preciso y maniobra paciente decidirán.'],
      opening: ['{player} desarrolla {piece} a {toSquare}.'],
      move: ['{player} lleva la {piece} a {toSquare}.'],
      capture: ['{player} captura {capturedPiece} en {toSquare}.'],
      check: ['¡Jaque! {opponent} debe responder.'],
      checkmate: ['Jaque mate. {winner} gana la partida.'],
      stalemate: ['Tablas por ahogado; no hay jugadas legales.'],
      promotion: ['{player} corona en {toSquare}.'],
      castle: ['{player} enroca por el lado {castleSide}.'],
      endgame: ['Estamos en el final; cada tempo cuenta.'],
      outro: ['Desde {arena}, gracias por acompañarnos.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenue à {arena}. {speaker} avec vous : {player} contre {opponent}.'],
      introReply: ['Merci {speaker}. Calcul précis et manœuvre patiente feront la différence.'],
      opening: ['{player} développe {piece} en {toSquare}.'],
      move: ['{player} joue {piece} vers {toSquare}.'],
      capture: ['{player} capture {capturedPiece} en {toSquare}.'],
      check: ['Échec ! {opponent} doit répondre.'],
      checkmate: ['Échec et mat. {winner} gagne la partie.'],
      stalemate: ['Pat : aucune case légale, partie nulle.'],
      promotion: ['{player} promeut en {toSquare}.'],
      castle: ['{player} roque côté {castleSide}.'],
      endgame: ['Nous sommes en finale; chaque tempo compte.'],
      outro: ['Depuis {arena}, merci de votre présence.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['مرحبًا بكم في {arena}. معكم {speaker}: {player} ضد {opponent}.'],
      introReply: ['شكرًا {speaker}. الحساب الدقيق والمناورة الهادئة سيحسمان اللقاء.'],
      opening: ['{player} يطور {piece} إلى {toSquare}.'],
      move: ['{player} ينقل {piece} إلى {toSquare}.'],
      capture: ['{player} يلتقط {capturedPiece} على {toSquare}.'],
      check: ['كش! على {opponent} الرد.'],
      checkmate: ['كش مات. {winner} يحسم المباراة.'],
      stalemate: ['تعادل بالجمود؛ لا توجد حركات قانونية.'],
      promotion: ['{player} يرقّي في {toSquare}.'],
      castle: ['{player} يقوم بالتبييت جهة {castleSide}.'],
      endgame: ['دخلنا النهاية؛ كل نقلة محسوبة.'],
      outro: ['من {arena}، شكرًا للمتابعة.']
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Mirë se vini në {arena}. {speaker} me ju: {player} kundër {opponent}.'],
      introReply: ['Faleminderit {speaker}. Llogaritja e saktë dhe manovra e duruar vendosin ndeshjen.'],
      opening: ['{player} zhvillon {piece} në {toSquare}.'],
      move: ['{player} lëviz {piece} në {toSquare}.'],
      capture: ['{player} kap {capturedPiece} në {toSquare}.'],
      check: ['Shah! {opponent} duhet të përgjigjet.'],
      checkmate: ['Shah mat. {winner} fiton lojën.'],
      stalemate: ['Barazim nga pat—nuk ka lëvizje të ligjshme.'],
      promotion: ['{player} promovon në {toSquare}.'],
      castle: ['{player} bën rokadë në anën {castleSide}.'],
      endgame: ['Jemi në fundlojë; çdo tempo vlen.'],
      outro: ['Nga {arena}, faleminderit që na ndoqët.']
    }
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
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('sq')) return 'sq';
  if (normalized.startsWith('en')) return 'en';
  return normalized || 'en';
};

export const buildChessCommentaryLine = ({
  event,
  speaker = CHESS_BATTLE_SPEAKERS.lead,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
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

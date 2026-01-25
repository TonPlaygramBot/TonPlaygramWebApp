export const LUDO_BATTLE_SPEAKERS = Object.freeze({
  lead: 'Orion',
  analyst: 'Skye'
});

const SPEAKER_PROFILES = Object.freeze({
  Orion: {
    id: 'orion',
    name: 'Orion',
    style: 'Play-by-play'
  },
  Skye: {
    id: 'skye',
    name: 'Skye',
    style: 'Color analyst'
  }
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  roll: 0,
  tokensHome: 0,
  captureCount: 0,
  arena: 'Ludo Battle Royal arena'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} here as {player} faces {opponent} in Ludo Battle Royale.',
      'Match time at {arena}. {speaker} on the call—{player} versus {opponent} for Ludo supremacy.',
      'Greetings from {arena}. {speaker} with you for a tactical Ludo battle between {player} and {opponent}.'
    ],
    introReply: [
      'Thanks {speaker}. Expect calculated risks—safe squares and captures will define the tempo.',
      'Glad to be here, {speaker}. It is all about timing sixes and controlling the home stretch.',
      'Absolutely, {speaker}. Smart entries and disciplined defense decide this one.'
    ],
    diceRoll: [
      '{player} rolls a {roll}. That shapes the next sequence.',
      'A {roll} for {player}. Options are opening up.',
      '{player} finds a {roll}. The track is in play.'
    ],
    extraTurn: [
      '{player} hits a six and earns another roll.',
      'Six for {player}—extra turn coming.',
      '{player} lands the six. Momentum swings.'
    ],
    enter: [
      '{player} brings a token onto the track—opening the attack.',
      '{player} steps a token into play off the home pad.',
      'Entry made by {player}. A new runner joins the race.'
    ],
    move: [
      '{player} advances a token by {roll} spaces with control.',
      '{player} pushes the tempo, moving forward by {roll}.',
      '{player} opts for steady progress—{roll} spaces ahead.'
    ],
    capture: [
      '{player} captures {opponent} and sends them back to base.',
      'Big swing—{player} takes out {opponent} on the track.',
      '{player} lands the capture. {opponent} is reset.'
    ],
    safe: [
      '{player} settles on a safe square—protected for now.',
      'Smart positioning: {player} parks on safety.',
      '{player} chooses the safe tile and stays out of danger.'
    ],
    homeStretch: [
      '{player} is on the home stretch with {tokensHome} token(s) home.',
      '{player} is closing in—{tokensHome} token(s) already home.',
      '{player} moves through the home lane; {tokensHome} token(s) secured.'
    ],
    goal: [
      '{player} sends another token home. Total home: {tokensHome}.',
      '{player} banks a token in the finish—{tokensHome} home now.',
      '{player} completes another run; {tokensHome} tokens home.'
    ],
    win: [
      'Victory for {player}. A clean finish at {arena}.',
      '{player} wins the battle—composed and decisive.',
      'Match over. {player} takes Ludo Battle Royale.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. Great Ludo battle tonight.',
      'A sharp finish in Ludo Battle Royale. Thanks for watching.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['欢迎来到{arena}。{speaker}为您解说，{player}对阵{opponent}，Ludo Battle Royale。'],
      introReply: ['谢谢{speaker}。关键在于安全格与吃子节奏。'],
      diceRoll: ['{player}掷出{roll}点，局面随之展开。'],
      extraTurn: ['{player}掷出六点，获得额外回合。'],
      enter: ['{player}将棋子驶入赛道。'],
      move: ['{player}前进{roll}格，稳健推进。'],
      capture: ['{player}吃掉{opponent}，送回起点。'],
      safe: ['{player}落在安全格，暂时无忧。'],
      homeStretch: ['{player}进入终点区，已回家{tokensHome}枚。'],
      goal: ['{player}再送一枚回家，目前{tokensHome}枚完成。'],
      win: ['比赛结束，{player}获胜。'],
      outro: ['以上是{arena}的战报，感谢观看。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['{arena} से स्वागत है। {speaker} के साथ {player} बनाम {opponent}।'],
      introReply: ['धन्यवाद {speaker}। सुरक्षित घर और कैप्चर की टाइमिंग निर्णायक होगी।'],
      diceRoll: ['{player} ने {roll} फेंका। चालें खुल रही हैं।'],
      extraTurn: ['{player} को छक्का मिला, एक और मौका।'],
      enter: ['{player} ने मोहरा मैदान में उतारा।'],
      move: ['{player} {roll} घर आगे बढ़ा।'],
      capture: ['{player} ने {opponent} को काटा और वापस भेजा।'],
      safe: ['{player} सुरक्षित घर पर है।'],
      homeStretch: ['{player} होम स्ट्रेच में, {tokensHome} मोहरे घर।'],
      goal: ['{player} ने एक और मोहरा घर पहुँचाया। कुल {tokensHome}।'],
      win: ['मैच समाप्त। {player} विजेता।'],
      outro: ['{arena} से यही अपडेट। धन्यवाद।']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenidos a {arena}. {speaker} en la cabina: {player} contra {opponent}.'],
      introReply: ['Gracias {speaker}. Las casillas seguras y las capturas marcarán el ritmo.'],
      diceRoll: ['{player} saca {roll}. Se abren las opciones.'],
      extraTurn: ['{player} consigue un seis y repite turno.'],
      enter: ['{player} pone una ficha en juego.'],
      move: ['{player} avanza {roll} casillas con control.'],
      capture: ['{player} captura a {opponent} y lo manda a base.'],
      safe: ['{player} se coloca en casilla segura.'],
      homeStretch: ['{player} entra en la recta final con {tokensHome} fichas en casa.'],
      goal: ['{player} mete otra ficha. Total en casa: {tokensHome}.'],
      win: ['Final del duelo: {player} gana.'],
      outro: ['Eso es todo desde {arena}. Gracias por acompañarnos.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenue à {arena}. {speaker} avec vous : {player} face à {opponent}.'],
      introReply: ['Merci {speaker}. Les cases sûres et les captures vont dicter le tempo.'],
      diceRoll: ['{player} obtient un {roll}. Les options s’ouvrent.'],
      extraTurn: ['Six pour {player} : un tour bonus.'],
      enter: ['{player} met un pion en jeu.'],
      move: ['{player} avance de {roll} cases.'],
      capture: ['{player} capture {opponent} et le renvoie à la base.'],
      safe: ['{player} se place sur une case sûre.'],
      homeStretch: ['{player} est dans la dernière ligne droite avec {tokensHome} pions rentrés.'],
      goal: ['{player} rentre un pion de plus. Total : {tokensHome}.'],
      win: ['C’est fini : {player} s’impose.'],
      outro: ['C’était {arena}. Merci de nous avoir suivis.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['مرحبًا بكم في {arena}. معكم {speaker}، {player} ضد {opponent}.'],
      introReply: ['شكرًا {speaker}. المربعات الآمنة والالتقاطات ستحدد الإيقاع.'],
      diceRoll: ['{player} يرمي {roll}. الخيارات تتضح.'],
      extraTurn: ['ستة لـ {player} وفرصة إضافية.'],
      enter: ['{player} يُدخل قطعة إلى المسار.'],
      move: ['{player} يتقدم {roll} خطوات بثبات.'],
      capture: ['{player} يلتقط {opponent} ويعيده للبداية.'],
      safe: ['{player} على مربع آمن.'],
      homeStretch: ['{player} في الممر النهائي، {tokensHome} قطعة وصلت.'],
      goal: ['{player} يُدخل قطعة جديدة للبيت. الإجمالي {tokensHome}.'],
      win: ['انتهت المباراة: {player} يفوز.'],
      outro: ['هذا كل شيء من {arena}. شكرًا للمتابعة.']
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Mirë se vini në {arena}. {speaker} me ju: {player} kundër {opponent}.'],
      introReply: ['Faleminderit {speaker}. Katrorët e sigurt dhe kapjet vendosin ritmin.'],
      diceRoll: ['{player} hodhi {roll}. Opsionet po hapen.'],
      extraTurn: ['{player} merr gjashtë dhe fiton një radhë tjetër.'],
      enter: ['{player} fut një gur në lojë.'],
      move: ['{player} avancon {roll} hapa me kontroll.'],
      capture: ['{player} kap {opponent} dhe e kthen në bazë.'],
      safe: ['{player} vendoset në katror të sigurt.'],
      homeStretch: ['{player} në sprintin final me {tokensHome} gurë në shtëpi.'],
      goal: ['{player} sjell një gur tjetër në shtëpi. Totali: {tokensHome}.'],
      win: ['Ndeshja mbyllet: {player} fiton.'],
      outro: ['Kaq nga {arena}. Faleminderit që na ndoqët.']
    }
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  diceRoll: 'diceRoll',
  extraTurn: 'extraTurn',
  enter: 'enter',
  move: 'move',
  capture: 'capture',
  safe: 'safe',
  homeStretch: 'homeStretch',
  goal: 'goal',
  win: 'win',
  outro: 'outro'
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

const resolveLanguageKey = (language = 'en') => {
  const normalized = String(language || '').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('sq')) return 'sq';
  if (normalized.startsWith('en')) return 'en';
  return normalized || 'en';
};

export const buildCommentaryLine = ({
  event,
  speaker = LUDO_BATTLE_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === LUDO_BATTLE_SPEAKERS.lead
      ? LUDO_BATTLE_SPEAKERS.analyst
      : LUDO_BATTLE_SPEAKERS.lead
  };

  const pool = templates.common[EVENT_POOLS[event]] || templates.common.move;

  return applyTemplate(pickRandom(pool), mergedContext);
};

export const createMatchCommentaryScript = ({
  players = { A: 'Player A', B: 'Player B' },
  commentators = [LUDO_BATTLE_SPEAKERS.lead, LUDO_BATTLE_SPEAKERS.analyst],
  language = 'en',
  arena = DEFAULT_CONTEXT.arena
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.A,
    opponent: players.B,
    arena
  };

  return [
    {
      speaker: lead,
      text: buildCommentaryLine({
        event: EVENT_POOLS.intro,
        speaker: lead,
        language,
        context
      })
    },
    {
      speaker: analyst,
      text: buildCommentaryLine({
        event: EVENT_POOLS.introReply,
        speaker: analyst,
        language,
        context
      })
    }
  ];
};

export const LUDO_BATTLE_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

export const LUDO_BATTLE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

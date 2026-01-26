export const SNAKE_LADDER_SPEAKERS = Object.freeze({
  lead: 'Mason',
  analyst: 'Lena'
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player',
  opponent: 'the field',
  arena: 'Snake & Ladder arena',
  roll: '1',
  from: '1',
  to: '1',
  delta: '0',
  need: '1',
  victim: 'an opponent'
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  roll: 'roll',
  ladder: 'ladder',
  snake: 'snake',
  bonus: 'bonus',
  capture: 'capture',
  exactNeeded: 'exactNeeded',
  startBlocked: 'startBlocked',
  needSix: 'needSix',
  win: 'win',
  outro: 'outro'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} here with {partner}. {player} takes on {opponent} in Snakes & Ladders.',
      'We are live from {arena}. {speaker} on the mic as {player} faces {opponent} in Snakes & Ladders.'
    ],
    introReply: [
      'Thanks {speaker}. It is a fast, tactical race—ladders lift you, snakes punish you.',
      'Good to be here, {speaker}. It is all about momentum swings and clean rolls.'
    ],
    roll: [
      '{player} rolls a {roll}.',
      '{player} throws a {roll} and eyes the next climb.'
    ],
    ladder: [
      '{player} climbs from {from} to {to}. That is a lift of {delta}.',
      'Ladder boost! {player} jumps from {from} to {to}.'
    ],
    snake: [
      'Snake bite for {player}—down from {from} to {to}.',
      '{player} hits a snake and slides from {from} to {to}.'
    ],
    bonus: [
      '{player} earns a bonus roll.',
      'Extra turn coming up for {player}.'
    ],
    capture: [
      '{player} bumps {victim} back to start.',
      '{player} lands on {victim} and sends them back.'
    ],
    exactNeeded: [
      '{player} needs an exact {need} to finish.',
      'Exact roll required: {player} needs {need}.'
    ],
    startBlocked: [
      '{player} needs a six to enter the board.',
      'No entry yet—{player} must roll a six to start.'
    ],
    needSix: [
      '{player} needs a six to keep both dice in play.',
      'A six is required here for {player}.'
    ],
    win: [
      '{player} reaches the final tile and wins the race!',
      'Victory for {player}! The finish line is crossed.'
    ],
    outro: [
      'That is the race from {arena}. Thanks for watching.',
      'From {arena}, that wraps it up. See you next time.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        '欢迎来到{arena}。{speaker}与{partner}为您解说。{player}对阵{opponent}。'
      ],
      introReply: [
        '谢谢{speaker}。节奏很快，梯子助攻，蛇梯惩罚。'
      ],
      roll: [
        '{player}掷出{roll}。'
      ],
      ladder: [
        '{player}从{from}爬到{to}，前进{delta}格。'
      ],
      snake: [
        '{player}踩到蛇，从{from}滑到{to}。'
      ],
      bonus: [
        '{player}获得额外一次掷骰。'
      ],
      capture: [
        '{player}把{victim}送回起点。'
      ],
      exactNeeded: [
        '{player}需要掷出精准的{need}才能结束。'
      ],
      startBlocked: [
        '{player}需要掷出6才能入场。'
      ],
      needSix: [
        '{player}需要一个6。'
      ],
      win: [
        '{player}到达终点并获胜！'
      ],
      outro: [
        '{arena}的比赛结束，感谢观看。'
      ]
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        '{arena} में स्वागत है। {speaker} और {partner} आपके साथ हैं। {player} बनाम {opponent}।'
      ],
      introReply: [
        'धन्यवाद {speaker}. तेज़ रफ्तार की रेस है—सीढ़ियाँ ऊपर, साँप नीचे।'
      ],
      roll: [
        '{player} ने {roll} रोल किया।'
      ],
      ladder: [
        '{player} {from} से {to} तक चढ़ता है—{delta} कदम की बढ़त।'
      ],
      snake: [
        '{player} साँप पर फिसल गया—{from} से {to}।'
      ],
      bonus: [
        '{player} को बोनस रोल मिला।'
      ],
      capture: [
        '{player} ने {victim} को फिर से स्टार्ट पर भेजा।'
      ],
      exactNeeded: [
        '{player} को जीतने के लिए ठीक {need} चाहिए।'
      ],
      startBlocked: [
        '{player} को शुरू करने के लिए 6 चाहिए।'
      ],
      needSix: [
        '{player} को 6 चाहिए।'
      ],
      win: [
        '{player} फाइनल टाइल पर पहुंचकर जीत गया!'
      ],
      outro: [
        '{arena} से इतना ही, देखने के लिए धन्यवाद।'
      ]
    }
  },
  ru: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Добро пожаловать на {arena}. {speaker} и {partner} с вами. {player} против {opponent}.'
      ],
      introReply: [
        'Спасибо {speaker}. Быстрая гонка: лестницы поднимают, змеи наказывают.'
      ],
      roll: [
        '{player} бросает {roll}.'
      ],
      ladder: [
        '{player} поднимается с {from} на {to}, рывок {delta}.'
      ],
      snake: [
        '{player} попадает на змею: с {from} на {to}.'
      ],
      bonus: [
        '{player} получает бонусный бросок.'
      ],
      capture: [
        '{player} отправляет {victim} назад на старт.'
      ],
      exactNeeded: [
        '{player} нужен точный {need}, чтобы финишировать.'
      ],
      startBlocked: [
        '{player} нужна шестёрка, чтобы войти.'
      ],
      needSix: [
        '{player} нужна шестёрка.'
      ],
      win: [
        '{player} достигает финиша и побеждает!'
      ],
      outro: [
        'Это была гонка на {arena}. Спасибо за просмотр.'
      ]
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Bienvenidos a {arena}. {speaker} y {partner} en la narración. {player} contra {opponent}.'
      ],
      introReply: [
        'Gracias, {speaker}. Carrera intensa: escaleras arriba, serpientes abajo.'
      ],
      roll: [
        '{player} saca un {roll}.'
      ],
      ladder: [
        '{player} sube de {from} a {to}—avance de {delta}.'
      ],
      snake: [
        '{player} cae en una serpiente: de {from} a {to}.'
      ],
      bonus: [
        '{player} consigue un turno extra.'
      ],
      capture: [
        '{player} envía a {victim} de vuelta al inicio.'
      ],
      exactNeeded: [
        '{player} necesita un {need} exacto para terminar.'
      ],
      startBlocked: [
        '{player} necesita un seis para entrar.'
      ],
      needSix: [
        '{player} necesita un seis.'
      ],
      win: [
        '¡{player} llega a la meta y gana!'
      ],
      outro: [
        'Desde {arena}, esto fue todo. Gracias por acompañarnos.'
      ]
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Bienvenue à {arena}. {speaker} et {partner} au commentaire. {player} face à {opponent}.'
      ],
      introReply: [
        'Merci {speaker}. Une course rapide : échelles pour monter, serpents pour descendre.'
      ],
      roll: [
        '{player} lance un {roll}.'
      ],
      ladder: [
        '{player} grimpe de {from} à {to}, gain de {delta}.'
      ],
      snake: [
        '{player} tombe sur un serpent : de {from} à {to}.'
      ],
      bonus: [
        '{player} obtient un lancer bonus.'
      ],
      capture: [
        '{player} renvoie {victim} au départ.'
      ],
      exactNeeded: [
        '{player} a besoin d’un {need} exact pour finir.'
      ],
      startBlocked: [
        '{player} doit faire un six pour entrer.'
      ],
      needSix: [
        '{player} a besoin d’un six.'
      ],
      win: [
        '{player} atteint la dernière case et gagne!'
      ],
      outro: [
        'Depuis {arena}, c’est terminé. Merci de votre présence.'
      ]
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'مرحبًا بكم في {arena}. {speaker} و{partner} معكم. {player} ضد {opponent}.'
      ],
      introReply: [
        'شكرًا {speaker}. سباق سريع: السلالم للأعلى والثعابين للأسفل.'
      ],
      roll: [
        '{player} يرمي {roll}.'
      ],
      ladder: [
        '{player} يصعد من {from} إلى {to} بفارق {delta}.'
      ],
      snake: [
        '{player} يقع على ثعبان من {from} إلى {to}.'
      ],
      bonus: [
        '{player} يحصل على رمية إضافية.'
      ],
      capture: [
        '{player} يعيد {victim} إلى البداية.'
      ],
      exactNeeded: [
        '{player} يحتاج رقم {need} بالضبط لإنهاء السباق.'
      ],
      startBlocked: [
        '{player} يحتاج إلى ستة للدخول.'
      ],
      needSix: [
        '{player} يحتاج إلى ستة.'
      ],
      win: [
        '{player} يصل إلى النهاية ويفوز!'
      ],
      outro: [
        'من {arena}، هذا ختام السباق. شكرًا للمتابعة.'
      ]
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Mirë se vini në {arena}. {speaker} dhe {partner} me ju. {player} kundër {opponent}.'
      ],
      introReply: [
        'Faleminderit {speaker}. Garë e shpejtë: shkallët ngrejnë, gjarpërinjtë zbresin.'
      ],
      roll: [
        '{player} hodhi {roll}.'
      ],
      ladder: [
        '{player} ngjitet nga {from} në {to}, fitim {delta}.'
      ],
      snake: [
        '{player} bie te gjarpri: nga {from} në {to}.'
      ],
      bonus: [
        '{player} merr një hedhje bonus.'
      ],
      capture: [
        '{player} e kthen {victim} në start.'
      ],
      exactNeeded: [
        '{player} ka nevojë për {need} të saktë për të mbyllur.'
      ],
      startBlocked: [
        '{player} duhet të hedhë 6 për të hyrë.'
      ],
      needSix: [
        '{player} ka nevojë për një 6.'
      ],
      win: [
        '{player} arrin në fund dhe fiton!'
      ],
      outro: [
        'Nga {arena}, kaq ishte. Faleminderit që na ndiqni.'
      ]
    }
  }
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

export const buildSnakeCommentaryLine = ({
  event,
  speaker = SNAKE_LADDER_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === SNAKE_LADDER_SPEAKERS.lead
      ? SNAKE_LADDER_SPEAKERS.analyst
      : SNAKE_LADDER_SPEAKERS.lead
  };
  const pool = templates.common[EVENT_POOLS[event]] || templates.common.roll;
  return applyTemplate(pickRandom(pool), mergedContext);
};

export const createSnakeMatchCommentaryScript = ({
  players = { A: 'Player', B: 'the field' },
  commentators = [SNAKE_LADDER_SPEAKERS.lead, SNAKE_LADDER_SPEAKERS.analyst],
  language = 'en',
  arena = DEFAULT_CONTEXT.arena
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.A,
    opponent: players.B,
    arena
  };

  const start = [
    {
      speaker: lead,
      text: buildSnakeCommentaryLine({
        event: EVENT_POOLS.intro,
        speaker: lead,
        language,
        context
      })
    },
    {
      speaker: analyst,
      text: buildSnakeCommentaryLine({
        event: EVENT_POOLS.introReply,
        speaker: analyst,
        language,
        context
      })
    }
  ];

  const end = [
    {
      speaker: lead,
      text: buildSnakeCommentaryLine({
        event: EVENT_POOLS.outro,
        speaker: lead,
        language,
        context
      })
    }
  ];

  return { start, end };
};

export const SNAKE_LADDER_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

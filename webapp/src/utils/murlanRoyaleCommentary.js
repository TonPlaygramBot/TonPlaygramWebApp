export const MURLAN_ROYALE_SPEAKERS = Object.freeze({
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
  combo: 'a clean combo',
  cardsLeft: 0,
  table: 'the main table',
  arena: 'Murlan Royale arena',
  scoreline: 'level at 0-0',
  round: 'this hand'
});

const LOCALIZED_DEFAULT_CONTEXT = Object.freeze({
  zh: {
    player: '玩家A',
    opponent: '玩家B',
    combo: '一手稳健的组合',
    table: '主桌',
    arena: '穆兰皇家竞技场',
    scoreline: '比分0比0持平',
    round: '本局'
  },
  hi: {
    player: 'खिलाड़ी A',
    opponent: 'खिलाड़ी B',
    combo: 'साफ कॉम्बो',
    table: 'मुख्य टेबल',
    arena: 'मुरलान रॉयल एरिना',
    scoreline: 'स्कोर 0-0 बराबर',
    round: 'यह हाथ'
  },
  ru: {
    player: 'Игрок A',
    opponent: 'Игрок B',
    combo: 'чистая комбинация',
    table: 'главный стол',
    arena: 'арена Murlan Royale',
    scoreline: 'счет 0-0',
    round: 'эта раздача'
  },
  es: {
    player: 'Jugador A',
    opponent: 'Jugador B',
    combo: 'un combo limpio',
    table: 'la mesa principal',
    arena: 'arena Murlan Royale',
    scoreline: 'igualados 0-0',
    round: 'esta mano'
  },
  fr: {
    player: 'Joueur A',
    opponent: 'Joueur B',
    combo: 'un combo propre',
    table: 'la table principale',
    arena: 'arène Murlan Royale',
    scoreline: 'score nul 0-0',
    round: 'cette manche'
  },
  ar: {
    player: 'اللاعب A',
    opponent: 'اللاعب B',
    combo: 'تركيبة نظيفة',
    table: 'الطاولة الرئيسية',
    arena: 'ساحة مورلان رويال',
    scoreline: 'التعادل 0-0',
    round: 'هذه اليد'
  },
  sq: {
    player: 'Lojtari A',
    opponent: 'Lojtari B',
    combo: 'një kombinim i pastër',
    table: 'tavolina kryesore',
    arena: 'arena Murlan Royale',
    scoreline: 'barazim 0-0',
    round: 'kjo dorë'
  }
});

const LOCALIZED_SPEAKERS = Object.freeze({
  zh: {
    Mason: '梅森',
    Lena: '莉娜'
  },
  hi: {
    Mason: 'मोहन',
    Lena: 'लीना'
  },
  ru: {
    Mason: 'Мейсон',
    Lena: 'Лена'
  },
  es: {
    Mason: 'Mason',
    Lena: 'Lena'
  },
  fr: {
    Mason: 'Mason',
    Lena: 'Lena'
  },
  ar: {
    Mason: 'ميسون',
    Lena: 'لينا'
  },
  sq: {
    Mason: 'Mejson',
    Lena: 'Lena'
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  shuffle: 'shuffle',
  firstMove: 'firstMove',
  play: 'play',
  pass: 'pass',
  single: 'single',
  pair: 'pair',
  trips: 'trips',
  straight: 'straight',
  flush: 'flush',
  fullHouse: 'fullHouse',
  straightFlush: 'straightFlush',
  bomb: 'bomb',
  clearTable: 'clearTable',
  close: 'close',
  win: 'win',
  outro: 'outro'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} with {partner} as {player} meets {opponent} in Murlan Royale.',
      'Live from {arena}. {speaker} alongside {partner} for tonight’s Murlan Royale showdown.',
      '{speaker} on the call at {arena}. {player} versus {opponent}, and the tempo is about to spike.'
    ],
    introReply: [
      'Thanks {speaker}. Combo selection and tempo control will shape this hand.',
      'Great to be here, {speaker}. Watch the timing on bombs and the race to shed cards.',
      'Absolutely, {speaker}. Disciplined passes and clean combos decide the edge.'
    ],
    shuffle: [
      'Cards are in the air; opening hands are set.',
      'The deal is done. Let us see who claims the first lead.',
      'Hands are live and the table is ready.'
    ],
    firstMove: [
      '{player} opens with {combo}, setting the rhythm early.',
      'First lead belongs to {player} with {combo}.',
      '{player} starts the action with {combo}.'
    ],
    play: [
      '{player} plays {combo} and keeps the pressure on.',
      '{player} lays down {combo} with composed timing.',
      'A confident play from {player}: {combo}.'
    ],
    pass: [
      '{player} passes and yields the tempo.',
      '{player} takes the pass; the table stays with {opponent}.',
      '{player} lets it go—discipline over risk.'
    ],
    single: [
      '{player} drops {combo} to manage the pace.',
      '{player} checks the tempo with {combo}.'
    ],
    pair: [
      '{player} pairs up with {combo}.',
      '{player} shows a pair: {combo}.'
    ],
    trips: [
      '{player} rolls out trips—{combo}.',
      '{player} commands the table with trips: {combo}.'
    ],
    straight: [
      '{player} strings a straight: {combo}.',
      'Straight down—{player} with {combo}.'
    ],
    flush: [
      '{player} delivers a flush and tightens control.',
      'Flush on the felt—{player} with {combo}.'
    ],
    fullHouse: [
      '{player} locks in a full house.',
      'Full house played by {player}.'
    ],
    straightFlush: [
      'Straight flush! {player} takes command.',
      '{player} lands a straight flush and turns the hand.'
    ],
    bomb: [
      'Bomb on the table—{player} detonates {combo}.',
      '{player} drops the bomb and swings the momentum.'
    ],
    clearTable: [
      'The table clears. {player} takes the lead.',
      'Reset on the table; {player} has control.'
    ],
    close: [
      '{player} is down to {cardsLeft} cards—finish line in sight.',
      '{player} has {cardsLeft} left; the endgame is near.'
    ],
    win: [
      '{player} is out of cards and wins the hand.',
      '{player} closes it out—hand secured.',
      '{player} finishes the run and takes the hand.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. A sharp Murlan Royale battle.',
      'A professional finish in {round}. Thanks for watching.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['欢迎来到{arena}。{speaker}与{partner}为您解说，{player}对阵{opponent}。'],
      introReply: ['谢谢{speaker}。组合选择与节奏控制将决定胜负。'],
      shuffle: ['发牌结束，比赛开始。'],
      firstMove: ['{player}率先出牌：{combo}。'],
      play: ['{player}打出{combo}，继续施压。'],
      pass: ['{player}选择过牌，节奏让给{opponent}。'],
      single: ['{player}出{combo}，稳住节奏。'],
      pair: ['{player}亮出对子：{combo}。'],
      trips: ['{player}打出三条：{combo}。'],
      straight: ['{player}连顺：{combo}。'],
      flush: ['{player}同花上桌：{combo}。'],
      fullHouse: ['{player}打出葫芦。'],
      straightFlush: ['同花顺！{player}掌控局面。'],
      bomb: ['炸弹登场！{player}打出{combo}。'],
      clearTable: ['桌面清空，{player}继续领先。'],
      close: ['{player}只剩{cardsLeft}张牌。'],
      win: ['{player}出完手牌，赢下本局。'],
      outro: ['{arena}的比赛到此结束，感谢观看。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['{arena} से स्वागत है। {speaker} और {partner} आपके साथ हैं। {player} बनाम {opponent}।'],
      introReply: ['धन्यवाद {speaker}. संयोजन की समझ और गति ही बाज़ी तय करेंगे।'],
      shuffle: ['कार्ड बँट गए हैं, खेल शुरू।'],
      firstMove: ['{player} ने शुरुआत की: {combo}।'],
      play: ['{player} ने {combo} खेला और दबाव बनाया।'],
      pass: ['{player} पास करता है, बढ़त {opponent} के पास।'],
      single: ['{player} ने {combo} से चाल संभाली।'],
      pair: ['{player} ने जोड़ी दिखाई: {combo}।'],
      trips: ['{player} ने तिकड़ी खेली: {combo}।'],
      straight: ['{player} की सीधी चाल: {combo}।'],
      flush: ['{player} ने रंग जमाया: {combo}।'],
      fullHouse: ['{player} का फुल हाउस।'],
      straightFlush: ['सीधा रंग! {player} ने बाज़ी पलटी।'],
      bomb: ['बॉम्ब! {player} ने {combo} फोड़ा।'],
      clearTable: ['टेबल साफ़, बढ़त {player} के पास।'],
      close: ['{player} के पास अब {cardsLeft} कार्ड बचे हैं।'],
      win: ['{player} ने सारे कार्ड उतार दिए, हाथ जीत लिया।'],
      outro: ['{arena} से इतना ही, देखने के लिए धन्यवाद।']
    }
  },
  ru: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Добро пожаловать на {arena}. {speaker} и {partner}. {player} против {opponent}.'],
      introReply: ['Спасибо, {speaker}. Темп и комбинации решат эту раздачу.'],
      shuffle: ['Раздача завершена, начинаем.'],
      firstMove: ['{player} открывает комбинацией {combo}.'],
      play: ['{player} играет {combo} и держит давление.'],
      pass: ['{player} пасует, темп у {opponent}.'],
      single: ['{player} контролирует темп с {combo}.'],
      pair: ['{player} показывает пару: {combo}.'],
      trips: ['{player} выкладывает сет: {combo}.'],
      straight: ['У {player} стрит: {combo}.'],
      flush: ['{player} кладет флеш: {combo}.'],
      fullHouse: ['{player} собирает фул-хаус.'],
      straightFlush: ['Стрит-флеш! {player} берет контроль.'],
      bomb: ['Бомба на столе! {player} с {combo}.'],
      clearTable: ['Стол очищен, лидирует {player}.'],
      close: ['У {player} осталось {cardsLeft} карт.'],
      win: ['{player} выходит из карт и выигрывает.'],
      outro: ['С {arena} на этом всё, спасибо за игру.']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenidos a {arena}. {speaker} con {partner}. {player} contra {opponent}.'],
      introReply: ['Gracias {speaker}. El ritmo y los combos dictarán la mano.'],
      shuffle: ['Reparto completo, arranca la mano.'],
      firstMove: ['{player} abre con {combo}.'],
      play: ['{player} juega {combo} y mantiene la presión.'],
      pass: ['{player} pasa y cede el tempo.'],
      single: ['{player} controla con {combo}.'],
      pair: ['{player} muestra pareja: {combo}.'],
      trips: ['{player} juega trío: {combo}.'],
      straight: ['{player} arma escalera: {combo}.'],
      flush: ['{player} coloca color: {combo}.'],
      fullHouse: ['{player} asegura full house.'],
      straightFlush: ['¡Escalera de color! {player} toma el control.'],
      bomb: ['¡Bomba en mesa! {player} con {combo}.'],
      clearTable: ['Mesa limpia, {player} lleva la iniciativa.'],
      close: ['{player} tiene {cardsLeft} cartas restantes.'],
      win: ['{player} se queda sin cartas y gana la mano.'],
      outro: ['Desde {arena}, gracias por acompañarnos.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenue à {arena}. {speaker} avec {partner}. {player} contre {opponent}.'],
      introReply: ['Merci {speaker}. Le tempo et les combinaisons feront la différence.'],
      shuffle: ['Distribution terminée, la manche commence.'],
      firstMove: ['{player} ouvre avec {combo}.'],
      play: ['{player} joue {combo} et garde la pression.'],
      pass: ['{player} passe et laisse le tempo.'],
      single: ['{player} temporise avec {combo}.'],
      pair: ['{player} pose une paire : {combo}.'],
      trips: ['{player} envoie un brelan : {combo}.'],
      straight: ['{player} aligne une suite : {combo}.'],
      flush: ['{player} place une couleur : {combo}.'],
      fullHouse: ['{player} verrouille un full.'],
      straightFlush: ['Quinte flush ! {player} prend l’avantage.'],
      bomb: ['Bombe posée ! {player} avec {combo}.'],
      clearTable: ['Table nettoyée, {player} garde la main.'],
      close: ['{player} n’a plus que {cardsLeft} cartes.'],
      win: ['{player} n’a plus de cartes et remporte la manche.'],
      outro: ['Depuis {arena}, merci d’avoir suivi.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['مرحبًا بكم في {arena}. معكم {speaker} و{partner}. {player} ضد {opponent}.'],
      introReply: ['شكرًا {speaker}. اختيار التركيبات وإدارة الإيقاع سيحسمان اليد.'],
      shuffle: ['تم توزيع الأوراق، لنبدأ.'],
      firstMove: ['{player} يبدأ بـ {combo}.'],
      play: ['{player} يلعب {combo} ويحافظ على الضغط.'],
      pass: ['{player} يمرر ويترك الإيقاع لـ {opponent}.'],
      single: ['{player} يهدئ اللعب بـ {combo}.'],
      pair: ['{player} يضع زوجًا: {combo}.'],
      trips: ['{player} يلعب ثلاثية: {combo}.'],
      straight: ['{player} يصنع ستريت: {combo}.'],
      flush: ['{player} يضع فلش: {combo}.'],
      fullHouse: ['{player} يثبت فل هاوس.'],
      straightFlush: ['ستريت فلش! {player} يسيطر على اليد.'],
      bomb: ['قنبلة على الطاولة! {player} بـ {combo}.'],
      clearTable: ['تم مسح الطاولة، {player} يتقدم.'],
      close: ['لم يتبق لـ {player} سوى {cardsLeft} أوراق.'],
      win: ['{player} أنهى أوراقه وفاز باليد.'],
      outro: ['من {arena}، شكرًا لمتابعتكم.']
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Mirë se vini në {arena}. {speaker} me {partner}. {player} kundër {opponent}.'],
      introReply: ['Faleminderit {speaker}. Zgjedhja e kombinimeve dhe ritmi vendosin rezultatin.'],
      shuffle: ['Kartat u shpërndanë, loja fillon.'],
      firstMove: ['{player} hap me {combo}.'],
      play: ['{player} luan {combo} dhe mban presionin.'],
      pass: ['{player} kalon dhe i lë ritmin {opponent}.'],
      single: ['{player} hedh {combo} për të kontrolluar ritmin.'],
      pair: ['{player} nxjerr një çift: {combo}.'],
      trips: ['{player} luan treshe: {combo}.'],
      straight: ['{player} bën një drejtë: {combo}.'],
      flush: ['{player} vendos një ngjyrë: {combo}.'],
      fullHouse: ['{player} siguron një shtëpi të plotë.'],
      straightFlush: ['Drejtë e ngjyrës! {player} merr kontrollin.'],
      bomb: ['Bombë në tavolinë! {player} me {combo}.'],
      clearTable: ['Tavolina pastrohet, {player} merr kontrollin.'],
      close: ['{player} ka edhe {cardsLeft} letra.'],
      win: ['{player} mbaron kartat dhe fiton dorën.'],
      outro: ['Nga {arena}, faleminderit që na ndoqët.']
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

export const buildMurlanCommentaryLine = ({
  event,
  speaker = MURLAN_ROYALE_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const languageKey = resolveLanguageKey(language);
  const templates = LOCALIZED_TEMPLATES[languageKey] || ENGLISH_TEMPLATES;
  const localizedDefaults = LOCALIZED_DEFAULT_CONTEXT[languageKey] || {};
  const partner =
    speaker === MURLAN_ROYALE_SPEAKERS.lead
      ? MURLAN_ROYALE_SPEAKERS.analyst
      : MURLAN_ROYALE_SPEAKERS.lead;
  const localizedSpeakers = LOCALIZED_SPEAKERS[languageKey] || {};
  const resolvedArena =
    languageKey !== 'en' && (!context.arena || context.arena === DEFAULT_CONTEXT.arena)
      ? localizedDefaults.arena || DEFAULT_CONTEXT.arena
      : context.arena ?? DEFAULT_CONTEXT.arena;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...localizedDefaults,
    ...context,
    arena: resolvedArena,
    speaker: localizedSpeakers[speaker] ?? speaker,
    partner: localizedSpeakers[partner] ?? partner
  };

  const eventPool = templates.common[EVENT_POOLS[event]] || templates.common.play;

  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const resolveMurlanLanguageKey = resolveLanguageKey;

export const createMurlanMatchCommentaryScript = ({
  players = { A: 'Player A', B: 'Player B' },
  commentators = [MURLAN_ROYALE_SPEAKERS.analyst],
  language = 'en',
  scoreline = 'level at 0-0'
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
    { speaker: lead, event: EVENT_POOLS.shuffle },
    { speaker: analyst, event: EVENT_POOLS.firstMove },
    { speaker: lead, event: EVENT_POOLS.play },
    { speaker: analyst, event: EVENT_POOLS.pass },
    { speaker: lead, event: EVENT_POOLS.close },
    { speaker: analyst, event: EVENT_POOLS.win },
    { speaker: lead, event: EVENT_POOLS.outro }
  ];

  return script.map((entry, index) => {
    const speaker = entry.speaker ?? commentators[index % commentators.length];
    return {
      speaker,
      text: buildMurlanCommentaryLine({
        event: entry.event,
        speaker,
        language,
        context: { ...context, ...(entry.context ?? {}) }
      })
    };
  });
};

export const MURLAN_ROYALE_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

export const MURLAN_ROYALE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

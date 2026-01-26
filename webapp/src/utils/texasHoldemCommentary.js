export const TEXAS_HOLDEM_SPEAKERS = Object.freeze({
  lead: 'Grant',
  analyst: 'Maya'
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  amount: '0',
  pot: '0',
  stage: 'pre-flop',
  table: 'the main table',
  arena: "Texas Hold'em arena",
  blinds: 'ante'
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  newHand: 'newHand',
  blinds: 'blinds',
  preflop: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
  check: 'check',
  call: 'call',
  bet: 'bet',
  raise: 'raise',
  fold: 'fold',
  allIn: 'allIn',
  showdown: 'showdown',
  potWin: 'potWin',
  potSplit: 'potSplit',
  outro: 'outro'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      "Welcome to {arena}. {speaker} here with {partner} for tonight's Texas Hold'em.",
      "Good evening from {arena}. {speaker} on the call with {partner}.",
      "We are live at {arena}. {speaker} alongside {partner} for high-stakes Hold'em."
    ],
    introReply: [
      'Thanks {speaker}. The patience game starts now—timing and pressure will decide it.',
      'Great to be with you, {speaker}. Discipline and position will separate the field.',
      'Absolutely, {speaker}. Every decision counts in this deep-stacked battle.'
    ],
    newHand: [
      'New hand underway. Chips are in motion and the tension builds.',
      'Fresh deal. Let us see who takes control early.',
      'Another hand begins—position and pressure are everything.'
    ],
    blinds: [
      '{blinds} posted. Action opens with {player}.',
      'Blinds in, and {player} has the first look.',
      'The forced bets are down. {player} starts the action.'
    ],
    preflop: [
      'Pre-flop action in full swing as the table sizes each other up.',
      'Early street decisions here—{player} weighs the price.',
      'Pre-flop: eyes on the tempo and table dynamics.'
    ],
    flop: [
      'The flop hits the felt—new texture, new decisions.',
      'Flop on the board. The betting landscape shifts.',
      'Here comes the flop; pressure spots begin to form.'
    ],
    turn: [
      'Turn card arrives. The pot can grow quickly from here.',
      'Turn is down. Commitments get serious now.',
      'Fourth street is live—this is where pots inflate.'
    ],
    river: [
      'River card dealt. Final decisions on the felt.',
      'The river is out—last chance to apply pressure.',
      'Fifth street. The finish line is in sight.'
    ],
    check: [
      '{player} checks and keeps the pot controlled.',
      '{player} taps the table—no bet.',
      '{player} checks it back, holding position.'
    ],
    call: [
      '{player} calls {amount} to stay in the hand.',
      '{player} matches {amount}.',
      '{player} makes the call for {amount}.'
    ],
    bet: [
      '{player} opens for {amount}.',
      '{player} fires {amount} into the pot.',
      '{player} leads out for {amount}.'
    ],
    raise: [
      '{player} raises to {amount}.',
      '{player} bumps it up to {amount}.',
      '{player} puts in the raise, now {amount}.'
    ],
    fold: [
      '{player} folds and steps away from the pot.',
      '{player} releases the hand.',
      '{player} lets it go.'
    ],
    allIn: [
      '{player} moves all-in for {amount}.',
      '{player} shoves for {amount}.',
      '{player} is all-in, putting {amount} on the line.'
    ],
    showdown: [
      "Showdown time—hands will be revealed.",
      'We are headed to showdown.',
      'The betting is done. Showdown decides it.'
    ],
    potWin: [
      '{player} wins the pot of {pot}.',
      '{player} takes it down for {pot}.',
      '{player} scoops {pot}.'
    ],
    potSplit: [
      'Split pot: {player} share {pot}.',
      'The pot is divided—{player} split {pot}.',
      'It is a chop. {player} share {pot}.'
    ],
    outro: [
      'That wraps up the table action. Thanks for watching.',
      'From {arena}, that is the end of the session.',
      'All done at the felt—thanks for joining us.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['欢迎来到{arena}，{speaker}和{partner}为您带来德州扑克解说。'],
      introReply: ['谢谢{speaker}。位置与节奏将决定胜负。'],
      newHand: ['新一手开始，牌局再次升温。'],
      blinds: ['盲注已下，轮到{player}先行动。'],
      flop: ['翻牌落下，局势更新。'],
      turn: ['转牌出现，底池压力升级。'],
      river: ['河牌到来，最后决策时刻。'],
      check: ['{player}过牌，控制底池。'],
      call: ['{player}跟注{amount}。'],
      bet: ['{player}下注{amount}。'],
      raise: ['{player}加注到{amount}。'],
      fold: ['{player}弃牌。'],
      allIn: ['{player}全下，投入{amount}。'],
      showdown: ['进入摊牌阶段。'],
      potWin: ['{player}赢下{pot}。'],
      potSplit: ['平分底池，{player}分享{pot}。'],
      outro: ['本局结束，感谢观看。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['{arena} से नमस्कार। {speaker} और {partner} आपके साथ हैं।'],
      introReply: ['धन्यवाद {speaker}. टेम्पो और पोज़िशन आज फर्क लाएँगे।'],
      newHand: ['नई हैंड शुरू—दबाव बढ़ रहा है।'],
      blinds: ['ब्लाइंड्स लग चुकी हैं, {player} से एक्शन शुरू।'],
      flop: ['फ्लॉप खुला—नया टेक्सचर।'],
      turn: ['टर्न आया—पॉट अब भारी हो सकता है।'],
      river: ['रिवर कार्ड—आख़िरी फैसला।'],
      check: ['{player} चेक करता है।'],
      call: ['{player} {amount} कॉल करता है।'],
      bet: ['{player} {amount} की बेट।'],
      raise: ['{player} {amount} तक रेज़।'],
      fold: ['{player} फोल्ड करता है।'],
      allIn: ['{player} {amount} के साथ ऑल-इन।'],
      showdown: ['शोडाउन का समय।'],
      potWin: ['{player} {pot} का पॉट जीतता है।'],
      potSplit: ['पॉट विभाजित—{player} {pot} साझा करते हैं।'],
      outro: ['यहाँ से विदा, धन्यवाद।']
    }
  },
  ru: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Добро пожаловать на {arena}. {speaker} и {partner} в эфире.'],
      introReply: ['Спасибо {speaker}. Терпение и позиция решают всё.'],
      newHand: ['Новая раздача начинается.'],
      blinds: ['Блайнды поставлены, действие за {player}.'],
      flop: ['Флоп на столе — новая текстура.'],
      turn: ['Терн открыт, давление растет.'],
      river: ['Ривер на столе, финальные решения.'],
      check: ['{player} чек.'],
      call: ['{player} коллирует {amount}.'],
      bet: ['{player} ставит {amount}.'],
      raise: ['{player} повышает до {amount}.'],
      fold: ['{player} фолдит.'],
      allIn: ['{player} идет олл-ин на {amount}.'],
      showdown: ['Переходим к шоудауну.'],
      potWin: ['{player} забирает банк {pot}.'],
      potSplit: ['Банк делится, {player} делят {pot}.'],
      outro: ['Сессия завершена, спасибо за просмотр.']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenidos a {arena}. {speaker} y {partner} con ustedes.'],
      introReply: ['Gracias {speaker}. La paciencia y la posición mandan.'],
      newHand: ['Nueva mano en marcha.'],
      blinds: ['Ciegas colocadas, {player} abre la acción.'],
      flop: ['Sale el flop—nuevo panorama.'],
      turn: ['Turn en mesa, la presión sube.'],
      river: ['River en mesa, decisión final.'],
      check: ['{player} pasa.'],
      call: ['{player} paga {amount}.'],
      bet: ['{player} apuesta {amount}.'],
      raise: ['{player} sube a {amount}.'],
      fold: ['{player} se retira.'],
      allIn: ['{player} va all-in con {amount}.'],
      showdown: ['Vamos al showdown.'],
      potWin: ['{player} gana el bote de {pot}.'],
      potSplit: ['Bote dividido, {player} comparten {pot}.'],
      outro: ['Así termina la sesión. Gracias por acompañarnos.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenue à {arena}. {speaker} avec {partner}.'],
      introReply: ['Merci {speaker}. La position va tout changer.'],
      newHand: ['Nouvelle main en cours.'],
      blinds: ['Blindes posées, {player} ouvre l’action.'],
      flop: ['Le flop tombe—nouvelle dynamique.'],
      turn: ['Turn dévoilé, la pression monte.'],
      river: ['River sur le tapis, dernière décision.'],
      check: ['{player} checke.'],
      call: ['{player} paye {amount}.'],
      bet: ['{player} mise {amount}.'],
      raise: ['{player} relance à {amount}.'],
      fold: ['{player} se couche.'],
      allIn: ['{player} part à tapis pour {amount}.'],
      showdown: ['Direction le showdown.'],
      potWin: ['{player} remporte {pot}.'],
      potSplit: ['Pot partagé, {player} se partagent {pot}.'],
      outro: ['Fin de session, merci d’être restés avec nous.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['مرحبًا بكم في {arena}. {speaker} مع {partner}.'],
      introReply: ['شكرًا {speaker}. التوقيت والموقع هما الأساس.'],
      newHand: ['يد جديدة تبدأ الآن.'],
      blinds: ['تم دفع الرهانات الإلزامية، {player} يبدأ.'],
      flop: ['ظهور الفلوب يغيّر الصورة.'],
      turn: ['الكرت الرابع—الضغط يتصاعد.'],
      river: ['الريفير هنا، القرار الأخير.'],
      check: ['{player} يمرر.'],
      call: ['{player} يساوي {amount}.'],
      bet: ['{player} يراهن {amount}.'],
      raise: ['{player} يرفع إلى {amount}.'],
      fold: ['{player} ينسحب.'],
      allIn: ['{player} يدفع كل ما لديه {amount}.'],
      showdown: ['الذهاب إلى كشف الأوراق.'],
      potWin: ['{player} يفوز بالرهان {pot}.'],
      potSplit: ['تقسيم الرهان، {player} يتشاركون {pot}.'],
      outro: ['نهاية الجلسة، شكرًا للمتابعة.']
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Mirë se vini në {arena}. {speaker} me {partner}.'],
      introReply: ['Faleminderit {speaker}. Pozicioni dhe koha janë vendimtare.'],
      newHand: ['Dorë e re në lojë.'],
      blinds: ['Blindat u vendosën, {player} hap aksionin.'],
      flop: ['Flopi del në tavolinë.'],
      turn: ['Turni vjen—presioni rritet.'],
      river: ['Riveri del, vendimi i fundit.'],
      check: ['{player} kontrollon.'],
      call: ['{player} barazon {amount}.'],
      bet: ['{player} baston {amount}.'],
      raise: ['{player} rrit në {amount}.'],
      fold: ['{player} hedh dorën.'],
      allIn: ['{player} shkon all-in për {amount}.'],
      showdown: ['Shkojmë në showdown.'],
      potWin: ['{player} fiton potin {pot}.'],
      potSplit: ['Poti ndahet, {player} ndajnë {pot}.'],
      outro: ['Mbyllet sesioni, faleminderit.']
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

export const buildTexasHoldemCommentaryLine = ({
  event,
  speaker = TEXAS_HOLDEM_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === TEXAS_HOLDEM_SPEAKERS.lead
      ? TEXAS_HOLDEM_SPEAKERS.analyst
      : TEXAS_HOLDEM_SPEAKERS.lead
  };
  const eventPool = templates.common[EVENT_POOLS[event]] || templates.common.newHand;
  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const TEXAS_HOLDEM_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

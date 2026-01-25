export const TEXAS_HOLDEM_SPEAKERS = Object.freeze({
  lead: 'Mason',
  analyst: 'Lena'
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player',
  opponent: 'the table',
  arena: "Texas Hold'em arena",
  stage: 'preflop',
  pot: 0,
  token: 'TPC',
  stake: 0,
  speaker: TEXAS_HOLDEM_SPEAKERS.analyst,
  partner: TEXAS_HOLDEM_SPEAKERS.lead,
  winner: 'Player',
  winners: 'Player',
  action: 'bet'
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  fold: 'fold',
  check: 'check',
  call: 'call',
  bet: 'bet',
  raise: 'raise',
  allIn: 'allIn',
  winner: 'winner'
});

const ENGLISH_TEMPLATES = Object.freeze({
  intro: [
    "Welcome to {arena}. {speaker} on the call as {player} joins {opponent} in the {stake} {token} game.",
    "We are live at {arena}. {speaker} here with {player} facing {opponent}.",
    "Match time at {arena}. {speaker} with you as {player} squares up with {opponent}."
  ],
  introReply: [
    "Thanks {speaker}. We'll track the pressure points and the tempo of this table.",
    "Great to be here, {speaker}. Discipline and timing will decide this pot flow.",
    "Absolutely, {speaker}. This is a game of patience, position, and calculated aggression."
  ],
  fold: [
    '{player} folds and lets this one go.',
    '{player} steps away from the pot.',
    '{player} releases the hand without a fight.'
  ],
  check: [
    '{player} checks, keeping the pot steady.',
    '{player} taps the table and checks.',
    '{player} takes the free look with a check.'
  ],
  call: [
    '{player} calls, matching the action.',
    '{player} makes the call and stays in.',
    '{player} calls and keeps the pressure contained.'
  ],
  bet: [
    '{player} opens with a bet.',
    '{player} puts chips in with a bet.',
    '{player} starts the betting in this round.'
  ],
  raise: [
    '{player} raises, turning up the heat.',
    '{player} bumps it up and applies pressure.',
    '{player} raises, testing the table.'
  ],
  allIn: [
    '{player} moves all-in. Maximum pressure.',
    '{player} shoves all-in for the pot.',
    '{player} goes all-in, putting everything on the line.'
  ],
  winner: [
    'Hand complete. {winner} claim the pot of {pot} {token}.',
    '{winner} collect {pot} {token} from this hand.',
    'Pot secured by {winner}: {pot} {token}.'
  ]
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    intro: ['欢迎来到{arena}。{speaker}为您解说，{player}对阵{opponent}。'],
    introReply: ['谢谢{speaker}。节奏与位置将决定这桌走势。'],
    fold: ['{player}弃牌，退出这一局。'],
    check: ['{player}选择过牌，保持底池不变。'],
    call: ['{player}跟注，继续留在牌局中。'],
    bet: ['{player}下注，主动发起进攻。'],
    raise: ['{player}加注，给对手施压。'],
    allIn: ['{player}全下，压力拉满。'],
    winner: ['牌局结束，{winner}赢得{pot} {token}的底池。']
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    intro: ['{arena} से स्वागत है। {speaker} के साथ {player} बनाम {opponent}।'],
    introReply: ['धन्यवाद {speaker}। धैर्य और समयिंग निर्णायक होंगे।'],
    fold: ['{player} फोल्ड करता है।'],
    check: ['{player} चेक करता है।'],
    call: ['{player} कॉल करता है।'],
    bet: ['{player} बेट लगाता है।'],
    raise: ['{player} रेज करता है, दबाव बढ़ाता है।'],
    allIn: ['{player} ऑल-इन जाता है।'],
    winner: ['हैंड पूरा हुआ, {winner} ने {pot} {token} का पॉट जीता।']
  },
  es: {
    ...ENGLISH_TEMPLATES,
    intro: ['Bienvenidos a {arena}. {speaker} en la cabina con {player} frente a {opponent}.'],
    introReply: ['Gracias {speaker}. La paciencia y el ritmo serán claves.'],
    fold: ['{player} se retira de la mano.'],
    check: ['{player} pasa y mantiene el bote igual.'],
    call: ['{player} iguala y sigue en juego.'],
    bet: ['{player} apuesta primero.'],
    raise: ['{player} sube la apuesta y presiona.'],
    allIn: ['{player} va all-in.'],
    winner: ['Mano terminada. {winner} gana el bote de {pot} {token}.']
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    intro: ['Bienvenue à {arena}. {speaker} aux commentaires avec {player} face à {opponent}.'],
    introReply: ['Merci {speaker}. La patience et le tempo vont décider.'],
    fold: ['{player} se couche.'],
    check: ['{player} checke et garde le pot stable.'],
    call: ['{player} paie et reste dans le coup.'],
    bet: ['{player} mise en premier.'],
    raise: ['{player} relance et met la pression.'],
    allIn: ['{player} part à tapis.'],
    winner: ['Main terminée. {winner} remporte {pot} {token}.']
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    intro: ['مرحبًا بكم في {arena}. {speaker} معكم و{player} أمام {opponent}.'],
    introReply: ['شكرًا {speaker}. الصبر والتوقيت هما الفيصل.'],
    fold: ['{player} ينسحب من اليد.'],
    check: ['{player} يمر بدون رهان.'],
    call: ['{player} يواكب بالاتصال.'],
    bet: ['{player} يفتتح الرهان.'],
    raise: ['{player} يرفع الرهان ويضغط.'],
    allIn: ['{player} يذهب بكل الرصيد.'],
    winner: ['انتهت اليد. {winner} يفوز بوعاء {pot} {token}.']
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    intro: ['Mirë se vini në {arena}. {speaker} me ju ndërsa {player} përballet me {opponent}.'],
    introReply: ['Faleminderit {speaker}. Durimi dhe ritmi do ta vendosin këtë tryezë.'],
    fold: ['{player} hedh letrat.'],
    check: ['{player} bën check dhe e mban potin të qetë.'],
    call: ['{player} bën call dhe qëndron në lojë.'],
    bet: ['{player} hap bastin.'],
    raise: ['{player} rrit bastin dhe ushtron presion.'],
    allIn: ['{player} shkon all-in.'],
    winner: ['Dora mbyllet. {winner} fiton potin prej {pot} {token}.']
  }
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
  const eventPool = templates[EVENT_POOLS[event]] || templates.call;
  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const TEXAS_HOLDEM_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

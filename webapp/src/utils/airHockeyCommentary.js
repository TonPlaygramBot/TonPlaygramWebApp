export const AIR_HOCKEY_SPEAKERS = Object.freeze({
  lead: 'Mason',
  analyst: 'Lena'
});

const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player',
  opponent: 'Opponent',
  playerScore: 0,
  opponentScore: 0,
  scoreline: 'level at 0-0',
  arena: 'Air Hockey arena',
  targetScore: 7
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} here with {partner}. {player} takes on {opponent}; {scoreline} to start.',
      'Match time at {arena}. {speaker} on the mic with {partner}. {player} versus {opponent}, {scoreline}.',
      'Good evening from {arena}. {speaker} and {partner} with you for {player} against {opponent}, {scoreline}.'
    ],
    introReply: [
      'Thanks {speaker}. It is all about quick hands, clean rebounds, and fast transitions.',
      'Glad to be here, {speaker}. Speed, angles, and composure decide air hockey matches.',
      'Absolutely, {speaker}. The pace is relentless—one mistake and the puck is in the net.'
    ],
    faceoff: [
      'Puck down—{player} takes the first touch.',
      'We are underway; {player} controls the opening faceoff.',
      'The puck is live, and {player} starts with possession.'
    ],
    pressure: [
      'Big moment for {player}; every touch has to be clean.',
      'Pressure shot here for {player}.',
      'This is where nerves show—{player} must execute.'
    ],
    attack: [
      '{player} pushes the tempo, looking for the opening.',
      'Quick transition from {player} into attack.',
      '{player} accelerates into the offensive zone.'
    ],
    save: [
      '{opponent} slams the door—excellent save.',
      'Brilliant reaction from {opponent} to deny the goal.',
      '{opponent} gets the pad down and keeps it out.'
    ],
    post: [
      'Off the post! {player} almost had the finish.',
      '{player} rings the iron—so close.',
      'That one clips the post from {player}.'
    ],
    goal: [
      'Goal for {player}! {scoreline}.',
      '{player} scores, and it is {scoreline}.',
      'The puck is in! {player} strikes—{scoreline}.'
    ],
    equalizer: [
      '{player} levels it up. {scoreline}.',
      'Equalizer from {player}; {scoreline}.',
      '{player} pulls it back to {scoreline}.'
    ],
    leadChange: [
      '{player} moves in front, {scoreline}.',
      '{player} takes the lead at {scoreline}.',
      'Lead change—{player} now ahead, {scoreline}.'
    ],
    matchPoint: [
      'Match point for {player}. One more to reach {targetScore}.',
      '{player} is on match point—one goal away from {targetScore}.',
      'Match point pressure now for {player}.'
    ],
    matchWin: [
      'Final whistle. {player} wins {playerScore}-{opponentScore}.',
      'Match over. {player} takes it {playerScore}-{opponentScore}.',
      '{player} closes it out, {playerScore}-{opponentScore}.'
    ],
    outro: [
      'That is full time from {arena}. Thanks for joining us.',
      'From {arena}, that wraps it up. Great match today.',
      'A fast, sharp finish in the arena. Thanks for watching.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['欢迎来到{arena}。{speaker}与{partner}为您解说，{player}对阵{opponent}，{scoreline}。'],
      introReply: ['谢谢{speaker}。节奏极快，手速与反弹判断将决定胜负。'],
      faceoff: ['开球！{player}率先掌控。'],
      pressure: ['关键时刻，{player}必须稳住手感。'],
      attack: ['{player}快速推进，寻找射门机会。'],
      save: ['{opponent}挡下这球，精彩防守。'],
      post: ['击中门柱！{player}差之毫厘。'],
      goal: ['进球！{player}得分，{scoreline}。'],
      equalizer: ['{player}扳平比分，{scoreline}。'],
      leadChange: ['{player}反超领先，{scoreline}。'],
      matchPoint: ['赛点到来，{player}距离{targetScore}只差一球。'],
      matchWin: ['比赛结束，{player}以{playerScore}-{opponentScore}获胜。'],
      outro: ['感谢收看，我们下次再见。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['{arena} में आपका स्वागत है। {speaker} और {partner} के साथ, {player} बनाम {opponent}—{scoreline}।'],
      introReply: ['धन्यवाद {speaker}। तेज़ हाथ, सही कोण और नियंत्रण ही फर्क डालेंगे।'],
      faceoff: ['खेल शुरू—पहला नियंत्रण {player} के पास।'],
      pressure: ['बड़ा क्षण, {player} को बिल्कुल सटीक होना होगा।'],
      attack: ['{player} तेज़ी से हमला बनाते हुए।'],
      save: ['{opponent} का शानदार बचाव।'],
      post: ['पोस्ट पर लगा! {player} थोड़ा चूके।'],
      goal: ['गोल! {player} ने किया, {scoreline}।'],
      equalizer: ['{player} ने बराबरी कर दी, {scoreline}।'],
      leadChange: ['{player} ने बढ़त बना ली, {scoreline}।'],
      matchPoint: ['मैच पॉइंट {player} के लिए—{targetScore} से एक गोल दूर।'],
      matchWin: ['मैच समाप्त। {player} जीतता है {playerScore}-{opponentScore}।'],
      outro: ['{arena} से धन्यवाद, अगली बार फिर मिलते हैं।']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenidos a {arena}. {speaker} y {partner} con ustedes: {player} contra {opponent}, {scoreline}.'],
      introReply: ['Gracias, {speaker}. Velocidad, ángulos y control marcarán la diferencia.'],
      faceoff: ['Se pone en juego: {player} con el primer toque.'],
      pressure: ['Momento clave para {player}.'],
      attack: ['{player} acelera al ataque.'],
      save: ['Atajadón de {opponent}.'],
      post: ['¡Al poste! {player} estuvo cerca.'],
      goal: ['¡Gol de {player}! {scoreline}.'],
      equalizer: ['{player} empata el partido, {scoreline}.'],
      leadChange: ['{player} se pone al frente, {scoreline}.'],
      matchPoint: ['Punto de partido para {player}, a un gol de {targetScore}.'],
      matchWin: ['Final del partido: {player} gana {playerScore}-{opponentScore}.'],
      outro: ['Gracias por acompañarnos desde {arena}.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Bienvenue à {arena}. {speaker} et {partner} avec vous : {player} contre {opponent}, {scoreline}.'],
      introReply: ['Merci {speaker}. Vitesse, angles et sang-froid feront la différence.'],
      faceoff: ['Coup d’envoi : {player} prend la première possession.'],
      pressure: ['Moment clé pour {player}.'],
      attack: ['{player} accélère en attaque.'],
      save: ['Arrêt superbe de {opponent}.'],
      post: ['Sur le poteau ! {player} était tout près.'],
      goal: ['But pour {player} ! {scoreline}.'],
      equalizer: ['{player} égalise, {scoreline}.'],
      leadChange: ['{player} prend l’avantage, {scoreline}.'],
      matchPoint: ['Balle de match pour {player}, à un but de {targetScore}.'],
      matchWin: ['Fin du match. {player} l’emporte {playerScore}-{opponentScore}.'],
      outro: ['Merci de nous avoir suivis depuis {arena}.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['مرحبًا بكم في {arena}. معكم {speaker} و{partner}: {player} ضد {opponent}، {scoreline}.'],
      introReply: ['شكرًا {speaker}. السرعة والزوايا والتحكم هي مفاتيح الفوز.'],
      faceoff: ['انطلاق اللعب، {player} يحصل على اللمسة الأولى.'],
      pressure: ['لحظة حاسمة لـ {player}.'],
      attack: ['{player} يندفع للهجوم.'],
      save: ['تصدي رائع من {opponent}.'],
      post: ['على القائم! {player} كان قريبًا للغاية.'],
      goal: ['هدف لـ {player}! {scoreline}.'],
      equalizer: ['{player} يعادل النتيجة، {scoreline}.'],
      leadChange: ['{player} يتقدم الآن، {scoreline}.'],
      matchPoint: ['نقطة مباراة لـ {player}، هدف واحد للوصول إلى {targetScore}.'],
      matchWin: ['نهاية المباراة. {player} يفوز {playerScore}-{opponentScore}.'],
      outro: ['شكرًا لمتابعتكم من {arena}.']
    }
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: ['Mirë se vini në {arena}. {speaker} dhe {partner} me ju: {player} kundër {opponent}, {scoreline}.'],
      introReply: ['Faleminderit {speaker}. Shpejtësia, këndet dhe kontrolli janë kyçe.'],
      faceoff: ['Nis loja, {player} me prekjen e parë.'],
      pressure: ['Moment i madh për {player}.'],
      attack: ['{player} shton ritmin në sulm.'],
      save: ['Mbrojtje e shkëlqyer nga {opponent}.'],
      post: ['Në shtyllë! {player} ishte shumë pranë.'],
      goal: ['Gol për {player}! {scoreline}.'],
      equalizer: ['{player} barazon rezultatin, {scoreline}.'],
      leadChange: ['{player} kalon në avantazh, {scoreline}.'],
      matchPoint: ['Pikë ndeshjeje për {player}, një gol larg {targetScore}.'],
      matchWin: ['Fundi i ndeshjes. {player} fiton {playerScore}-{opponentScore}.'],
      outro: ['Faleminderit që ishit me ne nga {arena}.']
    }
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  faceoff: 'faceoff',
  pressure: 'pressure',
  attack: 'attack',
  save: 'save',
  post: 'post',
  goal: 'goal',
  equalizer: 'equalizer',
  leadChange: 'leadChange',
  matchPoint: 'matchPoint',
  matchWin: 'matchWin',
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

export const buildAirHockeyCommentaryLine = ({
  event,
  speaker = AIR_HOCKEY_SPEAKERS.lead,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === AIR_HOCKEY_SPEAKERS.lead
      ? AIR_HOCKEY_SPEAKERS.analyst
      : AIR_HOCKEY_SPEAKERS.lead
  };
  const eventKey = EVENT_POOLS[event] || 'goal';
  const eventPool = templates.common[eventKey] || templates.common.goal;
  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const AIR_HOCKEY_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

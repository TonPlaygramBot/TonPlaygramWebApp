const DEFAULT_CONTEXT = Object.freeze({
  player: 'Player A',
  opponent: 'Player B',
  arena: 'Snooker Royal arena',
  table: 'main table',
  color: 'the color',
  points: 'four',
  foulReason: 'foul',
  breakTotal: '0',
  scoreline: 'level',
  frameNumber: 'this frame'
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  breakOff: 'breakOff',
  redPot: 'redPot',
  multiRed: 'multiRed',
  colorPot: 'colorPot',
  colorOrder: 'colorOrder',
  respot: 'respot',
  safety: 'safety',
  snooker: 'snooker',
  freeBall: 'freeBall',
  foul: 'foul',
  miss: 'miss',
  breakBuild: 'breakBuild',
  century: 'century',
  colorsOrder: 'colorsOrder',
  frameBall: 'frameBall',
  frameWin: 'frameWin',
  outro: 'outro',
  outroReply: 'outroReply',
  turn: 'turn'
});

const ENGLISH_TEMPLATES = Object.freeze({
  intro: [
    '{frameNumber} underway. {player} to break.',
    'Frame starts now. {player} on the break-off.',
    'Opening shot coming up from {player}.',
    '{player} to open this frame.',
    '{player} steps up for the break.'
  ],
  introReply: [
    'Table is set. Early safety expected.',
    'We are live. First visit will set the tone.',
    'Tactical opening here, with cue-ball control key.',
    'First shot is about control and soft spin.'
  ],
  breakOff: [
    '{player} breaks off, looking to keep it safe.',
    'Break-off from {player}. Cue ball to baulk.',
    '{player} opens with a controlled break.',
    '{player} sends the cue ball into baulk.',
    'Measured break from {player}.'
  ],
  redPot: [
    'Red down. {player} stays at the table.',
    '{player} pots a red and holds position.',
    'Clean red for {player}.',
    '{player} drops the red and keeps the cue ball in line.',
    'Red potted by {player}. Visit continues.'
  ],
  multiRed: [
    'Multiple reds fall. {player} opens the pack.',
    'Two reds down for {player}.',
    '{player} splits reds and stays in.',
    'Reds open up. {player} stays in control.',
    'A pair of reds for {player}.'
  ],
  colorPot: [
    '{color} potted by {player}.',
    '{player} lands the {color}.',
    'Color down. {player} keeps the break.',
    '{player} takes the {color} clean with perfect pace.',
    '{color} in. {player} stays in position.'
  ],
  colorOrder: [
    '{color} taken in order by {player}.',
    '{player} clears the {color}.',
    'That is the {color}. Clearance continues.',
    '{player} ticks off the {color} with tidy control.',
    'Sequence shot on the {color}.'
  ],
  respot: [
    '{color} down and respotted.',
    '{player} pots the {color}. It returns to the spot.',
    'Color potted. Back on the mark.',
    '{color} drops and is re-spotted.',
    '{player} takes the {color}. Respotted.'
  ],
  safety: [
    '{player} lays a safety.',
    'Safety from {player}. {opponent} back to work.',
    '{player} tucks the cue ball safe.',
    'Containment shot from {player}.',
    '{player} nudges it safe.'
  ],
  snooker: [
    '{player} leaves {opponent} snookered.',
    'Tight snooker. {opponent} has a tough escape.',
    '{player} hides the cue ball. Snooker on.',
    'Excellent snooker from {player}.',
    '{opponent} is forced to kick at it.'
  ],
  freeBall: [
    'Free ball called. {player} to take it.',
    '{player} has a free ball chance.',
    'Free ball on. {player} can build here.',
    'Free ball opportunity for {player}.',
    '{player} with the free ball option.'
  ],
  foul: [
    'Foul. {points} to {opponent}.',
    '{player} fouls. {opponent} gains {points}.',
    'Foul: {foulReason}. {points} to {opponent}.',
    '{points} points to {opponent} after the foul.',
    'Foul against {player}. {opponent} scores {points}.'
  ],
  miss: [
    '{player} misses. Chance for {opponent}.',
    'Missed pot. {opponent} comes in.',
    '{player} overcuts. {opponent} to the table.',
    'Just off for {player}.',
    '{player} fails to convert.'
  ],
  breakBuild: [
    '{player} moves to {breakTotal}.',
    'Break at {breakTotal} for {player}.',
    '{breakTotal} on the visit for {player}.',
    '{player} reaches {breakTotal}.',
    '{player} builds to {breakTotal}.'
  ],
  century: [
    'Century break. {player} hits {breakTotal}.',
    '{player} reaches one hundred.',
    'Hundred up for {player}.',
    '{player} posts {breakTotal}. Century confirmed.',
    'Century for {player}.'
  ],
  colorsOrder: [
    'Reds gone. Colors in sequence.',
    'Into the colors now.',
    'Colors phase starts.',
    'Only the colors remain.',
    'Colors in order from here.'
  ],
  frameBall: [
    'Frame ball for {player}.',
    '{player} on the frame ball.',
    'Frame ball chance here.',
    '{player} can close the frame.',
    'Frame ball on.'
  ],
  frameWin: [
    '{player} wins the frame. {scoreline}.',
    'Frame secured by {player}.',
    '{player} closes it out. {scoreline}.',
    'Frame to {player}.',
    '{player} takes it. {scoreline}.'
  ],
  outro: [
    '{frameNumber} ends. Score {scoreline}.',
    'Frame over. Score {scoreline}.',
    'End of the frame. {scoreline}.',
    '{frameNumber} complete. {scoreline}.',
    'That is the frame. {scoreline}.'
  ],
  outroReply: [
    'Next frame setup underway.',
    'Resetting for the next frame.',
    'Players reset for the next visit.',
    'Re-rack and reset.',
    'Ready to go again.'
  ],
  turn: [
    '{player} to play.',
    'Turn to {player}.',
    '{player} at the table.',
    '{player} to the shot.',
    '{player} in for the next visit.'
  ]
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber}开始，{player}开球。'],
    introReply: ['开局偏防守，母球控制很关键。'],
    breakOff: ['{player}开球，力求安全回球。'],
    redPot: ['红球进袋，{player}继续进攻。'],
    multiRed: ['多颗红球落袋，局面被打开。'],
    colorPot: ['{player}打进{color}，走位到位。'],
    colorOrder: ['按顺序清彩球，{player}保持节奏。'],
    respot: ['{color}进袋后重置回点位。'],
    safety: ['{player}选择防守，母球藏好。'],
    snooker: ['{player}做出斯诺克，{opponent}被挡住。'],
    freeBall: ['{player}获得自由球机会。'],
    foul: ['{player}犯规，{opponent}获得{points}分。'],
    miss: ['{player}失误，机会给到{opponent}。'],
    breakBuild: ['{player}单杆达到{breakTotal}。'],
    century: ['单杆破百，{player}打出{breakTotal}。'],
    colorsOrder: ['红球打完，进入彩球顺序阶段。'],
    frameBall: ['{player}迎来制胜球机会。'],
    frameWin: ['{player}赢下这一局，{scoreline}。'],
    outro: ['{frameNumber}结束，比分{scoreline}。'],
    outroReply: ['准备下一局。'],
    turn: ['轮到{player}出杆。']
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber} शुरू, {player} ब्रेक पर।'],
    introReply: ['शुरुआत में सुरक्षा और क्यू-बॉल नियंत्रण अहम है।'],
    breakOff: ['{player} ब्रेक खेलता है, सुरक्षित वापसी की कोशिश।'],
    redPot: ['लाल पॉट, {player} टेबल पर बना रहता है।'],
    multiRed: ['कई रेड्स गिरती हैं, खेल खुलता है।'],
    colorPot: ['{player} ने {color} पॉट किया, पोजिशन बढ़िया।'],
    colorOrder: ['क्रम में रंग, {player} नियंत्रण में।'],
    respot: ['{color} पॉट के बाद फिर स्पॉट पर।'],
    safety: ['{player} ने सुरक्षा खेली।'],
    snooker: ['{player} ने स्नूकर लगाया, {opponent} मुश्किल में।'],
    freeBall: ['{player} को फ्री बॉल मिली।'],
    foul: ['{player} से फाउल, {opponent} को {points} अंक।'],
    miss: ['{player} चूका, मौका {opponent} को।'],
    breakBuild: ['{player} का ब्रेक {breakTotal} तक।'],
    century: ['सेंचुरी ब्रेक, {player} ने {breakTotal} बनाया।'],
    colorsOrder: ['रेड्स खत्म, अब रंग क्रम में।'],
    frameBall: ['{player} के पास फ्रेम बॉल है।'],
    frameWin: ['{player} ने फ्रेम जीता, {scoreline}।'],
    outro: ['{frameNumber} समाप्त, स्कोर {scoreline}।'],
    outroReply: ['अगला फ्रेम तैयार।'],
    turn: ['अब {player} की बारी।']
  },
  es: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber} en marcha. {player} abre.'],
    introReply: ['Inicio táctico; el control de blanca es clave.'],
    breakOff: ['{player} rompe buscando dejarla segura.'],
    redPot: ['Roja embocada, {player} sigue.'],
    multiRed: ['Caen varias rojas, la mesa se abre.'],
    colorPot: ['{player} emboca la {color} con buena posición.'],
    colorOrder: ['Colores en orden, {player} mantiene el control.'],
    respot: ['{color} embocada y re-ubicada en el punto.'],
    safety: ['{player} juega seguridad.'],
    snooker: ['{player} deja a {opponent} en snooker.'],
    freeBall: ['Bola libre para {player}.'],
    foul: ['Falta de {player}. {points} para {opponent}.'],
    miss: ['{player} falla; entra {opponent}.'],
    breakBuild: ['{player} sube a {breakTotal}.'],
    century: ['Centena, {player} llega a {breakTotal}.'],
    colorsOrder: ['Sin rojas; colores en secuencia.'],
    frameBall: ['Bola de frame para {player}.'],
    frameWin: ['{player} gana el frame. {scoreline}.'],
    outro: ['{frameNumber} termina. {scoreline}.'],
    outroReply: ['Preparando el siguiente frame.'],
    turn: ['Turno de {player}.']
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber} lancé. {player} au break.'],
    introReply: ['Début tactique; contrôle de blanche essentiel.'],
    breakOff: ['{player} casse en sécurité.'],
    redPot: ['Rouge empochée, {player} reste à la table.'],
    multiRed: ['Plusieurs rouges tombent, le jeu s’ouvre.'],
    colorPot: ['{player} empoche la {color} avec bonne position.'],
    colorOrder: ['Couleurs en ordre, {player} garde la main.'],
    respot: ['{color} empochée puis replacée.'],
    safety: ['{player} joue sécurité.'],
    snooker: ['{player} met {opponent} en snooker.'],
    freeBall: ['Bille libre pour {player}.'],
    foul: ['Faute de {player}. {points} pour {opponent}.'],
    miss: ['{player} manque; {opponent} revient.'],
    breakBuild: ['{player} monte à {breakTotal}.'],
    century: ['Série de 100, {player} atteint {breakTotal}.'],
    colorsOrder: ['Plus de rouges; couleurs en ordre.'],
    frameBall: ['Bille de frame pour {player}.'],
    frameWin: ['{player} gagne la frame. {scoreline}.'],
    outro: ['{frameNumber} terminé. {scoreline}.'],
    outroReply: ['On prépare la frame suivante.'],
    turn: ['À {player} de jouer.']
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber} يبدأ. {player} على الكسر.'],
    introReply: ['بداية تكتيكية؛ التحكم بالبيضاء مهم.'],
    breakOff: ['{player} يكسر مع محاولة أمان.'],
    redPot: ['كرة حمراء تدخل، {player} يبقى على الطاولة.'],
    multiRed: ['سقوط عدة حمراء وفتح الطاولة.'],
    colorPot: ['{player} يودع {color} مع وضعية جيدة.'],
    colorOrder: ['الألوان بالترتيب، {player} يسيطر.'],
    respot: ['{color} تدخل ثم تُعاد إلى النقطة.'],
    safety: ['{player} يلعب أمانًا.'],
    snooker: ['{player} يضع {opponent} في سنوكر.'],
    freeBall: ['كرة حرة لـ {player}.'],
    foul: ['خطأ على {player}. {points} لـ {opponent}.'],
    miss: ['{player} يُخفق؛ الدور لـ {opponent}.'],
    breakBuild: ['{player} يصل إلى {breakTotal}.'],
    century: ['بريك مئة، {player} يصل إلى {breakTotal}.'],
    colorsOrder: ['انتهت الحمراء؛ الألوان بالترتيب.'],
    frameBall: ['كرة فريم لـ {player}.'],
    frameWin: ['{player} يفوز بالفريم. {scoreline}.'],
    outro: ['{frameNumber} ينتهي. {scoreline}.'],
    outroReply: ['الاستعداد للفريم التالي.'],
    turn: ['الدور على {player}.']
  },
  sq: {
    ...ENGLISH_TEMPLATES,
    intro: ['{frameNumber} nis. {player} me goditjen e hapjes.'],
    introReply: ['Fillim taktik; kontrolli i topit të bardhë është kyç.'],
    breakOff: ['{player} hap me kujdes, kërkon siguri.'],
    redPot: ['E kuqja futet, {player} qëndron në tavolinë.'],
    multiRed: ['Bien disa të kuqe; loja hapet.'],
    colorPot: ['{player} fut {color} me pozicion të mirë.'],
    colorOrder: ['Ngjyrat në rend; {player} mban kontrollin.'],
    respot: ['{color} futet dhe rikthehet në pikë.'],
    safety: ['{player} luan siguri.'],
    snooker: ['{player} e lë {opponent} në snooker.'],
    freeBall: ['Top i lirë për {player}.'],
    foul: ['Faull nga {player}. {points} për {opponent}.'],
    miss: ['{player} gabon; radha për {opponent}.'],
    breakBuild: ['{player} ngjitet në {breakTotal}.'],
    century: ['Njëqindëshe; {player} arrin {breakTotal}.'],
    colorsOrder: ['Të kuqet mbaruan; ngjyrat në rend.'],
    frameBall: ['Top i frejmit për {player}.'],
    frameWin: ['{player} fiton frejmin. {scoreline}.'],
    outro: ['{frameNumber} mbyllet. {scoreline}.'],
    outroReply: ['Po përgatitet frejmi tjetër.'],
    turn: ['Radha e {player}.']
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

export const buildSnookerCommentaryLine = ({ event, speaker = 'Caster', language = 'en', context = {} }) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker
  };
  const pool = templates[EVENT_POOLS[event]] || templates.redPot;
  return applyTemplate(pickRandom(pool), mergedContext);
};

export const createSnookerMatchCommentaryScript = ({
  players = { A: 'Player A', B: 'Player B' },
  commentators = ['Caster'],
  language = 'en',
  scoreline = 'level'
} = {}) => {
  const context = {
    player: players.A,
    opponent: players.B,
    scoreline
  };
  const lead = commentators[0] || 'Caster';
  const analyst = commentators[1] || lead;
  const start = [
    {
      speaker: lead,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.intro,
        speaker: lead,
        language,
        context
      })
    }
  ];
  if (analyst && analyst !== lead) {
    start.push({
      speaker: analyst,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.introReply,
        speaker: analyst,
        language,
        context
      })
    });
  }
  const end = [
    {
      speaker: lead,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.outro,
        speaker: lead,
        language,
        context
      })
    }
  ];
  if (analyst && analyst !== lead) {
    end.push({
      speaker: analyst,
      text: buildSnookerCommentaryLine({
        event: EVENT_POOLS.outroReply,
        speaker: analyst,
        language,
        context
      })
    });
  }
  return { start, end };
};

export const SNOOKER_ROYAL_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

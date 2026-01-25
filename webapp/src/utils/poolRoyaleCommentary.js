export const POOL_ROYALE_SPEAKERS = Object.freeze({
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
  playerScore: 0,
  opponentScore: 0,
  playerPoints: 0,
  opponentPoints: 0,
  playerPots: 0,
  opponentPots: 0,
  targetBall: 'the object ball',
  pocket: 'the pocket',
  potCount: 0,
  table: 'the main table',
  arena: 'Pool Royale arena',
  breakType: 'thunder break',
  scoreline: 'level at 0-0',
  groupPrimary: 'reds',
  groupSecondary: 'yellows',
  ballSet: 'uk',
  rackNumber: 'this rack'
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    intro: [
      'Welcome to {arena}. {speaker} here. {player} faces {opponent}; {scoreline} in {variantName}.',
      'Match time at {arena}. {speaker} with you. {player} versus {opponent} in {variantName}, {scoreline}.',
      'Good evening from {arena}. {speaker} on the call. {player} and {opponent} are locked at {playerScore}-{opponentScore}.'
    ],
    introReply: [
      'Thanks {speaker}. Points are precious—cue ball control and smart pattern play will decide it.',
      'Great to be here, {speaker}. The margins are razor thin, and position play is everything.',
      'Absolutely, {speaker}. {player} and {opponent} need clean pots and precise spin to control the table.'
    ],
    breakShot: [
      '{player} steps in for the break; a sharp split sets up early pots and a clean cue-ball path.',
      '{player} leans in. A controlled break and measured spin can define the first run.',
      'Here comes the break from {player}. Cue-ball control will be everything.'
    ],
    breakResult: [
      'Nice spread off the break, {speaker}. The rack is open with clear lanes.',
      'That break has cracked the pack—plenty of options with cue-ball routes available.',
      'Solid pop on the break. Now it is about speed control and touch.'
    ],
    openTable: [
      'Early pattern here—{player} wants natural angles and a simple route to the next pot.',
      'Plenty of options with the open table; cue ball paths and spin control decide the points.',
      '{player} is reading the table, mapping the next pot and the cue-ball landing zone.'
    ],
    safety: [
      'A smart safety. {player} tucks the cue ball behind a blocker.',
      'That is a measured safety, leaving {opponent} long and awkward with no clean lane.',
      '{player} turns down the pot and plays the percentage safety to protect the score.'
    ],
    pressure: [
      'Big moment. {player} needs this pot to keep the scoring run alive.',
      'Pressure shot here for {player}; it is all about soft touch, spin, and position.',
      'This is where nerves show—{player} has to deliver for the scoreboard.'
    ],
    pot: [
      '{player} pots {targetBall} into {pocket}, cue ball held in good position.',
      'Pot: {targetBall} in {pocket}.',
      '{player} sends {targetBall} down the {pocket} with smooth control.'
    ],
    combo: [
      '{player} combos {targetBall} into {pocket}, great sighting.',
      'Combination pot on {targetBall} into the {pocket}.',
      '{player} caroms {targetBall} into the {pocket} with precision.'
    ],
    bank: [
      '{player} banks {targetBall} into the {pocket} with clean speed.',
      'Bank shot: {targetBall} in the {pocket}.',
      '{player} sends {targetBall} off the cushion and down with control.'
    ],
    kick: [
      'Kick shot required—{player} goes one rail to find it.',
      'Tough kick for {player}; the cue ball needs a thin contact.',
      '{player} escapes with a kick. Excellent table awareness.'
    ],
    jump: [
      'Jump cue out—{player} goes airborne to clear the blocker.',
      'That is a confident jump shot from {player}.',
      'Jump shot executed; {player} gets the hit and stays in control.'
    ],
    miss: [
      '{player} misses the pot and leaves a look for {opponent}.',
      'No pot for {player}; the table opens up.',
      '{player} comes up short and loses the table.'
    ],
    foul: [
      'Foul on {player}.',
      'Foul called. {opponent} to the table with control.',
      '{player} commits a foul.'
    ],
    inHand: [
      'Ball in hand for {opponent}.',
      '{opponent} has ball in hand.',
      'Cue ball in hand for {opponent}.'
    ],
    runout: [
      '{player} is in rhythm—this could be a full clearance.',
      'A runout is on. {player} just needs clean angles and speed control.',
      '{player} is stitching it together, ball by ball.'
    ],
    hillHill: [
      'We are at hill-hill. This is as tense as it gets.',
      'Decider time. One rack for everything.',
      'Final rack nerves—every shot feels heavier now.'
    ],
    frameWin: [
      '{player} wins the rack with composed position play.',
      'Rack to {player}.',
      '{player} closes the rack.'
    ],
    matchWin: [
      'Match over. {player} wins {playerScore}-{opponentScore}.',
      '{player} takes the match, {playerScore}-{opponentScore}.',
      'Final score {playerScore}-{opponentScore}. {player} wins.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. Great match tonight.',
      'A fantastic finish in {variantName}. Thanks for watching with us.'
    ]
  },
  nineBall: {
    variantName: '9-ball American billiards',
    rotation: [
      'Rotation play means {player} must strike the lowest ball first.',
      'Nine-ball demands precision on the lowest ball every time.',
      'Lowest ball on first—classic nine-ball discipline.'
    ],
    goldenBreak: [
      'A golden break would end it instantly if the nine drops.',
      'Keep an eye on the nine—golden break possibilities here.',
      'If the nine falls on the snap, it is over.'
    ],
    comboNine: [
      '{player} is eyeing the combo into the nine—dangerous shot.',
      'That is a combo on the nine. Big swing if it goes.',
      'Nine-ball combo chance for {player}. This could finish the rack.'
    ],
    pushOut: [
      '{player} uses the push-out to gain a better look.',
      'Strategic push-out here, forcing a tough decision.',
      'Push-out played—now {opponent} must decide to shoot or pass.'
    ]
  },
  eightBallUs: {
    variantName: '8-ball American pool',
    groupCall: [
      'Open table between {groupPrimary} and {groupSecondary}; {player} is looking to claim one.',
      '{player} can choose {groupPrimary} or {groupSecondary}—the first clean pot decides the pattern.',
      'Plenty of options here; {groupPrimary} and {groupSecondary} are both available.'
    ],
    inHand: [
      'Foul gives {opponent} ball in hand—prime time for an 8-ball run.',
      '{opponent} has ball in hand, and that is a big swing in American 8-ball.',
      'Ball in hand now for {opponent}; expect a composed clearance attempt.'
    ],
    eightBall: [
      'The 8-ball is in play now. Position is everything.',
      'Everything moves through the 8-ball from here.',
      'Eight-ball on the table—one mistake decides it.'
    ]
  },
  eightBallUk: {
    variantName: '8-ball UK',
    groupCall: [
      'Open table between {groupPrimary} and {groupSecondary}; {player} will claim a set soon.',
      '{groupPrimary} versus {groupSecondary} in UK rules; the first clean pot sets the route.',
      'UK rules in play. {groupPrimary} and {groupSecondary} are both available.'
    ],
    freeBall: [
      'Foul gives {player} a free ball—huge advantage in UK rules.',
      'That is a free ball for {player}; they can use it tactically.',
      'UK rules apply: free ball and two visits for {player}.'
    ],
    blackBall: [
      'The black is in play now. This is the money ball.',
      'Everything goes through the black from here.',
      'Black ball time—perfect angle required.'
    ]
  }
});

const LOCALIZED_TEMPLATES = Object.freeze({
  en: ENGLISH_TEMPLATES,
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        '欢迎来到{arena}。{speaker}为您带来解说。{player}对阵{opponent}，{scoreline}，{variantName}。'
      ],
      introReply: [
        '谢谢{speaker}。今晚关键在于走位与旋转控制，每一杆都很重要。'
      ],
      breakShot: [
        '{player}准备开球，良好的炸散与母球控制会带来早期机会。'
      ],
      breakResult: [
        '开球炸散不错，球路已经打开，走位至关重要。'
      ],
      openTable: [
        '球形较开，{player}在寻找最自然的走位线路。'
      ],
      safety: [
        '{player}选择防守，把母球藏到安全位置。'
      ],
      pressure: [
        '关键一杆，{player}需要稳住力度与旋转。'
      ],
      pot: [
        '{player}将{targetBall}打进{pocket}，母球位置不错。'
      ],
      combo: [
        '{player}组合球进{pocket}，击球线路清晰。'
      ],
      bank: [
        '{player}打库进{pocket}，控制得当。'
      ],
      kick: [
        '{player}必须踢库解球，考验手感。'
      ],
      jump: [
        '{player}选择跳球，成功越过障碍。'
      ],
      miss: [
        '{player}未能进球，机会交给{opponent}。'
      ],
      foul: [
        '{player}犯规，{opponent}获得机会。'
      ],
      inHand: [
        '{opponent}获得自由球。'
      ],
      runout: [
        '{player}节奏很好，有机会一杆清台。'
      ],
      hillHill: [
        '决胜局，压力拉满。'
      ],
      frameWin: [
        '{player}拿下这一局。'
      ],
      matchWin: [
        '比赛结束，{player}以{playerScore}-{opponentScore}获胜。'
      ],
      outro: [
        '{arena}的比赛告一段落，感谢观看。'
      ]
    },
    nineBall: {
      variantName: '9球美式台球',
      rotation: ['9球规则必须先击打最小号球。'],
      goldenBreak: ['如果9号球在开球进袋就是金开球。'],
      comboNine: ['{player}考虑组合9号球，这一杆可能结束本局。'],
      pushOut: ['{player}选择推球，制造更好的局面。']
    },
    eightBallUs: {
      variantName: '美式8球',
      groupCall: ['开台阶段，{groupPrimary}与{groupSecondary}都可选择。'],
      inHand: ['{opponent}自由球在手，清台机会很大。'],
      eightBall: ['现在进入8号球阶段，走位决定胜负。']
    },
    eightBallUk: {
      variantName: '英式8球',
      groupCall: ['英式规则，{groupPrimary}与{groupSecondary}等待归属。'],
      freeBall: ['{player}获得自由球与两次击球机会。'],
      blackBall: ['黑球上台，角度要求很高。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        '{arena} से स्वागत है। {speaker} आपके साथ हैं। {player} बनाम {opponent}, {scoreline}, {variantName} में।'
      ],
      introReply: [
        'धन्यवाद {speaker}. आज नियंत्रण और स्पिन ही फ़र्क बनाएंगे।'
      ],
      breakShot: [
        '{player} ब्रेक के लिए तैयार है—फैलाव और क्यू-बॉल कंट्रोल अहम है।'
      ],
      breakResult: [
        'ब्रेक अच्छा रहा, टेबल खुल गई है और रास्ते साफ़ हैं।'
      ],
      openTable: [
        'टेबल खुला है—{player} आसान पॉट और पोजिशन की तलाश में है।'
      ],
      safety: [
        '{player} ने सुरक्षित खेला, क्यू-बॉल को ढक दिया।'
      ],
      pressure: [
        'यह दबाव भरा शॉट है—टच और स्पिन दोनों ज़रूरी हैं।'
      ],
      pot: [
        '{player} ने {targetBall} को {pocket} में पॉट किया, पोजिशन बढ़िया है।'
      ],
      combo: [
        '{player} ने कॉम्बिनेशन से {targetBall} को {pocket} में भेजा।'
      ],
      bank: [
        '{player} ने बैंक शॉट से {targetBall} को {pocket} में डाला।'
      ],
      kick: [
        '{player} को किक शॉट खेलना पड़ेगा—कठिन प्रयास।'
      ],
      jump: [
        '{player} ने जंप शॉट खेला और रास्ता बनाया।'
      ],
      miss: [
        '{player} पॉट नहीं कर पाए, मौका {opponent} को मिलता है।'
      ],
      foul: [
        '{player} से फाउल हो गया।'
      ],
      inHand: [
        '{opponent} के लिए बॉल इन हैंड।'
      ],
      runout: [
        '{player} रनआउट की स्थिति में है, बस साफ़ एंगल चाहिए।'
      ],
      hillHill: [
        'निर्णायक रैक—तनाव चरम पर।'
      ],
      frameWin: [
        '{player} ने यह रैक जीत लिया।'
      ],
      matchWin: [
        'मैच समाप्त। {player} ने {playerScore}-{opponentScore} से जीता।'
      ],
      outro: [
        '{arena} से यहीं तक, देखने के लिए धन्यवाद।'
      ]
    },
    nineBall: {
      variantName: '9-बॉल अमेरिकन',
      rotation: ['9-बॉल में हमेशा सबसे छोटी बॉल पहले लगती है।'],
      goldenBreak: ['ब्रेक पर 9 गिरा तो मैच वहीं खत्म।'],
      comboNine: ['{player} 9 की कॉम्बिनेशन देख रहा है—बड़ा मौका।'],
      pushOut: ['{player} पुश-आउट खेल कर बेहतर लाइन चाहता है।']
    },
    eightBallUs: {
      variantName: 'अमेरिकन 8-बॉल',
      groupCall: ['ओपन टेबल है; {groupPrimary} या {groupSecondary} चुन सकते हैं।'],
      inHand: ['{opponent} को बॉल इन हैंड मिला—बड़ा फायदा।'],
      eightBall: ['अब 8-बॉल का खेल, पोजिशन निर्णायक है।']
    },
    eightBallUk: {
      variantName: 'यूके 8-बॉल',
      groupCall: ['यूके नियमों में {groupPrimary} और {groupSecondary} खुले हैं।'],
      freeBall: ['{player} को फ्री बॉल और दो विज़िट मिलती हैं।'],
      blackBall: ['ब्लैक बॉल आ गई, एंगल बहुत जरूरी है।']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Bienvenidos a {arena}. {speaker} con ustedes. {player} contra {opponent}, {scoreline}, en {variantName}.'
      ],
      introReply: [
        'Gracias, {speaker}. Hoy manda el control de bola y el efecto.'
      ],
      breakShot: [
        '{player} va al saque; abrir la mesa y controlar la blanca es clave.'
      ],
      breakResult: [
        'Buen saque, la mesa está abierta y hay líneas claras.'
      ],
      openTable: [
        'Mesa abierta; {player} busca ángulos naturales y posición.'
      ],
      safety: [
        '{player} juega defensa y esconde la blanca.'
      ],
      pressure: [
        'Golpe de presión; toque suave y efecto preciso.'
      ],
      pot: [
        '{player} emboca {targetBall} en {pocket} y deja buena posición.'
      ],
      combo: [
        '{player} juega combinación y mete {targetBall} en {pocket}.'
      ],
      bank: [
        '{player} hace carambola a banda y mete {targetBall} en {pocket}.'
      ],
      kick: [
        '{player} debe ir a banda para encontrar la bola.'
      ],
      jump: [
        '{player} ejecuta un salto para superar el bloqueo.'
      ],
      miss: [
        '{player} falla el tiro; oportunidad para {opponent}.'
      ],
      foul: [
        'Falta de {player}.'
      ],
      inHand: [
        '{opponent} tiene bola en mano.'
      ],
      runout: [
        '{player} puede cerrar la mesa si mantiene el control.'
      ],
      hillHill: [
        'Rack decisivo—máxima tensión.'
      ],
      frameWin: [
        '{player} gana el rack.'
      ],
      matchWin: [
        'Final: {player} gana {playerScore}-{opponentScore}.'
      ],
      outro: [
        'Desde {arena}, gracias por acompañarnos.'
      ]
    },
    nineBall: {
      variantName: '9 bolas americano',
      rotation: ['En 9 bolas siempre se golpea primero la más baja.'],
      goldenBreak: ['Si cae la 9 en el saque, se termina la partida.'],
      comboNine: ['{player} mira la combinación a la 9, gran oportunidad.'],
      pushOut: ['{player} usa el push-out para mejorar el tiro.']
    },
    eightBallUs: {
      variantName: '8 bolas americano',
      groupCall: ['Mesa abierta entre {groupPrimary} y {groupSecondary}.'],
      inHand: ['{opponent} con bola en mano, ventaja clara.'],
      eightBall: ['Ahora la 8 está en juego; la posición manda.']
    },
    eightBallUk: {
      variantName: '8 bolas británico',
      groupCall: ['Reglas UK: {groupPrimary} y {groupSecondary} aún abiertos.'],
      freeBall: ['{player} tiene bola libre y dos visitas.'],
      blackBall: ['La negra está en juego; el ángulo es clave.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'Bienvenue à {arena}. {speaker} est avec vous. {player} contre {opponent}, {scoreline}, en {variantName}.'
      ],
      introReply: [
        'Merci, {speaker}. Le contrôle de blanche et l’effet feront la différence.'
      ],
      breakShot: [
        '{player} s’installe pour la casse; ouvrir la table et contrôler la blanche est essentiel.'
      ],
      breakResult: [
        'Bonne casse, la table est ouverte et les lignes sont propres.'
      ],
      openTable: [
        'Table ouverte; {player} cherche les angles naturels et la bonne position.'
      ],
      safety: [
        '{player} joue sécurité et cache la blanche.'
      ],
      pressure: [
        'Coup sous pression; toucher doux et effet précis.'
      ],
      pot: [
        '{player} empoche {targetBall} dans {pocket} et garde la position.'
      ],
      combo: [
        '{player} joue la combinaison et empoche {targetBall} dans {pocket}.'
      ],
      bank: [
        '{player} joue la bande et empoche {targetBall} dans {pocket}.'
      ],
      kick: [
        '{player} doit jouer un coup de bande pour toucher la bille.'
      ],
      jump: [
        '{player} tente un saut pour passer l’obstacle.'
      ],
      miss: [
        '{player} manque l’empochage; opportunité pour {opponent}.'
      ],
      foul: [
        'Faute de {player}.'
      ],
      inHand: [
        '{opponent} a la bille en main.'
      ],
      runout: [
        '{player} peut finir la table s’il garde le contrôle.'
      ],
      hillHill: [
        'Manche décisive—tension maximale.'
      ],
      frameWin: [
        '{player} remporte la manche.'
      ],
      matchWin: [
        'Match terminé. {player} gagne {playerScore}-{opponentScore}.'
      ],
      outro: [
        'Depuis {arena}, merci de votre présence.'
      ]
    },
    nineBall: {
      variantName: '9-ball américain',
      rotation: ['En 9-ball, on doit toucher la plus petite bille en premier.'],
      goldenBreak: ['Si la 9 tombe à la casse, la partie est finie.'],
      comboNine: ['{player} vise une combinaison sur la 9, gros coup.'],
      pushOut: ['{player} joue un push-out pour améliorer l’angle.']
    },
    eightBallUs: {
      variantName: '8-ball américain',
      groupCall: ['Table ouverte entre {groupPrimary} et {groupSecondary}.'],
      inHand: ['{opponent} a la bille en main, avantage net.'],
      eightBall: ['La 8 est en jeu; la position est cruciale.']
    },
    eightBallUk: {
      variantName: '8-ball UK',
      groupCall: ['Règles UK: {groupPrimary} et {groupSecondary} sont ouverts.'],
      freeBall: ['{player} a une bille libre et deux visites.'],
      blackBall: ['La noire est en jeu; l’angle compte.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      intro: [
        'مرحبًا بكم في {arena}. {speaker} معكم. {player} ضد {opponent}، {scoreline} في {variantName}.'
      ],
      introReply: [
        'شكرًا {speaker}. السيطرة على الكرة الأم والدوران ستكون حاسمة اليوم.'
      ],
      breakShot: [
        '{player} يستعد للكسر؛ فتح الطاولة مع تحكم بالكرة الأم مهم جدًا.'
      ],
      breakResult: [
        'كسر جيد، الطاولة مفتوحة والمسارات واضحة.'
      ],
      openTable: [
        'الطاولة مفتوحة؛ {player} يبحث عن زوايا طبيعية ووضعية جيدة.'
      ],
      safety: [
        '{player} يلعب أمانًا ويخفي الكرة الأم.'
      ],
      pressure: [
        'ضربة تحت ضغط؛ لمسة ناعمة ودوران مضبوط.'
      ],
      pot: [
        '{player} يودع {targetBall} في {pocket} ويثبت الوضعية.'
      ],
      combo: [
        '{player} يلعب كومبو ويودع {targetBall} في {pocket}.'
      ],
      bank: [
        '{player} يلعب بنك ويودع {targetBall} في {pocket}.'
      ],
      kick: [
        '{player} يحتاج ضربة كيك للوصول إلى الكرة.'
      ],
      jump: [
        '{player} ينفذ ضربة قفز لتجاوز العائق.'
      ],
      miss: [
        '{player} يفوت الكرة؛ فرصة لـ {opponent}.'
      ],
      foul: [
        'خطأ على {player}.'
      ],
      inHand: [
        '{opponent} لديه كرة في اليد.'
      ],
      runout: [
        '{player} يستطيع إنهاء الطاولة إذا حافظ على التحكم.'
      ],
      hillHill: [
        'شووط حاسم—توتر كبير.'
      ],
      frameWin: [
        '{player} يفوز بالشوط.'
      ],
      matchWin: [
        'نهاية المباراة. {player} يفوز {playerScore}-{opponentScore}.'
      ],
      outro: [
        'من {arena}، شكرًا على المتابعة.'
      ]
    },
    nineBall: {
      variantName: '9 بول أمريكي',
      rotation: ['في 9 بول يجب ضرب أقل كرة أولًا.'],
      goldenBreak: ['إذا دخلت 9 في الكسر فالمباراة تنتهي فورًا.'],
      comboNine: ['{player} ينظر إلى كومبو على 9—فرصة كبيرة.'],
      pushOut: ['{player} يستخدم البوش آوت لتحسين الرؤية.']
    },
    eightBallUs: {
      variantName: '8 بول أمريكي',
      groupCall: ['طاولة مفتوحة بين {groupPrimary} و{groupSecondary}.'],
      inHand: ['{opponent} يملك الكرة في اليد—أفضلية واضحة.'],
      eightBall: ['الآن الكرة 8 في اللعب؛ الوضعية هي الفاصل.']
    },
    eightBallUk: {
      variantName: '8 بول بريطاني',
      groupCall: ['قواعد UK: {groupPrimary} و{groupSecondary} مفتوحة.'],
      freeBall: ['{player} يحصل على كرة حرة وزيارتين.'],
      blackBall: ['الكرة السوداء في اللعب؛ الزاوية مهمة جدًا.']
    }
  }
});

const EVENT_POOLS = Object.freeze({
  intro: 'intro',
  introReply: 'introReply',
  breakShot: 'breakShot',
  breakResult: 'breakResult',
  openTable: 'openTable',
  safety: 'safety',
  pressure: 'pressure',
  pot: 'pot',
  combo: 'combo',
  bank: 'bank',
  kick: 'kick',
  jump: 'jump',
  miss: 'miss',
  foul: 'foul',
  inHand: 'inHand',
  runout: 'runout',
  hillHill: 'hillHill',
  frameWin: 'frameWin',
  matchWin: 'matchWin',
  outro: 'outro',
  rotation: 'rotation',
  goldenBreak: 'goldenBreak',
  comboNine: 'comboNine',
  pushOut: 'pushOut',
  groupCall: 'groupCall',
  freeBall: 'freeBall',
  blackBall: 'blackBall'
});

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

const applyTemplate = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(context[key] ?? `{${key}}`));

const resolveVariantData = (variantId, templates) => {
  const source = templates || ENGLISH_TEMPLATES;
  if (variantId === 'uk' || variantId === '8ball-uk') return source.eightBallUk;
  if (variantId === 'american' || variantId === '8ball-us') return source.eightBallUs;
  return source.nineBall;
};

const resolveLanguageKey = (language = 'en') => {
  const normalized = String(language || '').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('en')) return 'en';
  return normalized || 'en';
};

export const buildCommentaryLine = ({
  event,
  variant = '9ball',
  speaker = POOL_ROYALE_SPEAKERS.analyst,
  language = 'en',
  context = {}
}) => {
  const templates = LOCALIZED_TEMPLATES[resolveLanguageKey(language)] || ENGLISH_TEMPLATES;
  const resolvedVariant = resolveVariantData(variant, templates);
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
    speaker,
    partner: speaker === POOL_ROYALE_SPEAKERS.lead
      ? POOL_ROYALE_SPEAKERS.analyst
      : POOL_ROYALE_SPEAKERS.lead,
    variantName: resolvedVariant.variantName
  };

  const eventPool =
    resolvedVariant[EVENT_POOLS[event]] ||
    templates.common[EVENT_POOLS[event]] ||
    templates.common.pot;

  return applyTemplate(pickRandom(eventPool), mergedContext);
};

export const createMatchCommentaryScript = ({
  variant = '9ball',
  ballSet = 'uk',
  players = { A: 'Player A', B: 'Player B' },
  commentators = [POOL_ROYALE_SPEAKERS.analyst],
  language = 'en',
  scoreline = 'level at 0-0',
  scores = { A: 0, B: 0 },
  pots = { A: 0, B: 0 },
  points = { A: 0, B: 0 }
} = {}) => {
  const [lead, analyst] = commentators;
  const context = {
    player: players.A,
    opponent: players.B,
    scoreline,
    playerScore: scores.A ?? 0,
    opponentScore: scores.B ?? 0,
    playerPoints: points.A ?? scores.A ?? 0,
    opponentPoints: points.B ?? scores.B ?? 0,
    playerPots: pots.A ?? 0,
    opponentPots: pots.B ?? 0,
    ballSet
  };

  const script = [
    { speaker: lead, event: EVENT_POOLS.intro },
    { speaker: analyst, event: EVENT_POOLS.introReply },
    { speaker: lead, event: EVENT_POOLS.breakShot },
    { speaker: analyst, event: EVENT_POOLS.breakResult },
    { speaker: lead, event: EVENT_POOLS.openTable },
    { speaker: analyst, event: EVENT_POOLS.safety },
    { speaker: lead, event: EVENT_POOLS.pot },
    { speaker: analyst, event: EVENT_POOLS.pressure },
    { speaker: lead, event: EVENT_POOLS.runout },
    { speaker: analyst, event: EVENT_POOLS.frameWin },
    { speaker: lead, event: EVENT_POOLS.matchWin },
    { speaker: analyst, event: EVENT_POOLS.outro }
  ];

  const groupLabels =
    variant === 'uk'
      ? ballSet === 'american'
        ? { primary: 'solids', secondary: 'stripes' }
        : { primary: 'reds', secondary: 'yellows' }
      : { primary: 'solids', secondary: 'stripes' };

  const variantScriptExtras =
    variant === 'uk'
      ? [
          {
            speaker: lead,
            event: EVENT_POOLS.groupCall,
            context: { groupPrimary: groupLabels.primary, groupSecondary: groupLabels.secondary }
          },
          { speaker: analyst, event: EVENT_POOLS.freeBall },
          { speaker: lead, event: EVENT_POOLS.blackBall }
        ]
      : variant === 'american'
        ? [
            {
              speaker: lead,
              event: EVENT_POOLS.groupCall,
              context: { groupPrimary: groupLabels.primary, groupSecondary: groupLabels.secondary }
            },
            { speaker: analyst, event: EVENT_POOLS.inHand },
            { speaker: lead, event: EVENT_POOLS.blackBall }
          ]
        : [
            { speaker: lead, event: EVENT_POOLS.rotation },
            { speaker: analyst, event: EVENT_POOLS.goldenBreak },
            { speaker: lead, event: EVENT_POOLS.comboNine }
          ];

  const combined = [script[0], script[1], ...variantScriptExtras, ...script.slice(2)];

  return combined.map((entry, index) => {
    const speaker = entry.speaker ?? commentators[index % commentators.length];
    return {
      speaker,
      text: buildCommentaryLine({
        event: entry.event,
        variant,
        speaker,
        language,
        context: { ...context, ...(entry.context ?? {}) }
      })
    };
  });
};

export const POOL_ROYALE_COMMENTARY_EVENTS = Object.freeze({
  ...EVENT_POOLS
});

export const POOL_ROYALE_COMMENTATORS = Object.freeze({
  ...SPEAKER_PROFILES
});

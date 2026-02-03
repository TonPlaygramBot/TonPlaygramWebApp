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
  rackNumber: 'this rack',
  previousResult: 'a strong result'
});

const LOCALIZED_CONTEXT = Object.freeze({
  sq: {
    player: 'Lojtari A',
    opponent: 'Lojtari B',
    targetBall: 'topi objekt',
    pocket: 'xhepi',
    potCount: 0,
    table: 'tavolina kryesore',
    arena: 'Arena Pool Royale',
    breakType: 'thyerje e fortë',
    scoreline: 'barazim 0-0',
    groupPrimary: 'të kuqe',
    groupSecondary: 'të verdha',
    ballSet: 'uk',
    rackNumber: 'ky frejm',
    previousResult: 'rezultat i fortë'
  }
});

const GREETING_PREFIXES = Object.freeze({
  en: ['Hey,', 'Hello,', 'Hi,', 'Alright,', 'Welcome,', 'Good evening,'],
  es: ['Hola,', 'Buenas,', 'Saludos,', 'Qué tal,', 'Bienvenidos,'],
  fr: ['Bonjour,', 'Bonsoir,', 'Salut,', 'Bienvenue,', 'Bonsoir à tous,'],
  it: ['Ciao,', 'Buonasera,', 'Salve,', 'Benvenuti,', 'Buon match,'],
  ru: ['Здравствуйте,', 'Добрый вечер,', 'Привет,', 'Добрый день,', 'Здравствуйте всем,'],
  hi: ['नमस्ते,', 'हैलो,', 'स्वागत है,', 'नमस्कार,', 'चलिये,'],
  ar: ['مرحبًا،', 'أهلًا،', 'مساء الخير،', 'تحية طيبة،', 'أهلًا بكم،'],
  zh: ['大家好，', '你好，', '欢迎，', '各位好，', '晚上好，'],
  sq: ['Përshëndetje,', 'Mirë se vini,', 'Tungjatjeta,', 'Mirëmbrëma,', 'Mirëdita,']
});

const ENGLISH_TEMPLATES = Object.freeze({
  common: {
    welcome: [
      'Welcome to {arena}. {speaker} here with you for {variantName}.',
      'Great to have you with us at {arena}. {speaker} on commentary.',
      'Hello and welcome—{arena} is the stage for {player} versus {opponent}.',
      'What a setup tonight—{arena} is ready for {player} and {opponent}.',
      'Good to be with you—{arena} hosts {variantName} and a big matchup.'
    ],
    intro: [
      'Welcome to {arena}. {speaker} here. {player} faces {opponent}; {scoreline} in {variantName}.',
      'Match time at {arena}. {speaker} with you. {player} versus {opponent} in {variantName}, {scoreline}.',
      'Good evening from {arena}. {speaker} on the call. {player} and {opponent} are locked at {playerScore}-{opponentScore}.',
      '{arena} is live. {speaker} with you as {player} meets {opponent} in {variantName}.',
      'We are set at {arena}. {player} against {opponent}, {scoreline} so far.'
    ],
    introReply: [
      'Thanks {speaker}. Points are precious—cue ball control and smart pattern play will decide it.',
      'Great to be here, {speaker}. The margins are razor thin, and position play is everything.',
      'Absolutely, {speaker}. {player} and {opponent} need clean pots and precise spin to control the table.',
      'Exactly, {speaker}. Tempo, patience, and cue-ball routes will separate the best.',
      'Spot on, {speaker}. The best touch wins this kind of rack.'
    ],
    breakShot: [
      '{player} steps in for the break; a sharp split sets up early pots and a clean cue-ball path.',
      '{player} leans in. A controlled break and measured spin can define the first run.',
      'Here comes the break from {player}. Cue-ball control will be everything.',
      'This break matters—{player} can set the tone right here.',
      '{player} to break; watch the cue ball and the spread.'
    ],
    breakResult: [
      'Nice spread off the break, {speaker}. The rack is open with clear lanes.',
      'That break has cracked the pack—plenty of options with cue-ball routes available.',
      'Solid pop on the break. Now it is about speed control and touch.',
      'That break did the job—shots available, but position still matters.',
      'Decent split. The table is giving options.'
    ],
    openTable: [
      'Early pattern here—{player} wants natural angles and a simple route to the next pot.',
      'Plenty of options with the open table; cue ball paths and spin control decide the points.',
      '{player} is reading the table, mapping the next pot and the cue-ball landing zone.',
      '{player} has choices—key is landing the cue ball on the right side for the next target.',
      'Lots of routes available; position and shot selection will decide the run.',
      '{player} can go into rhythm now—keep it simple and keep it clean.',
      'Open table, but the angles are tight. It is all about precision.'
    ],
    safety: [
      'A smart safety. {player} tucks the cue ball behind a blocker.',
      'That is a measured safety, leaving {opponent} long and awkward with no clean lane.',
      '{player} turns down the pot and plays the percentage safety to protect the score.',
      'Not sure that safety is tight enough—{opponent} might have a look.',
      'Cagey choice; {player} is trying to freeze the table.',
      'Risky to pass up the pot, but the safety might pay off.'
    ],
    pressure: [
      'Big moment. {player} needs this pot to keep the scoring run alive.',
      'Pressure shot here for {player}; it is all about soft touch, spin, and position.',
      'This is where nerves show—{player} has to deliver for the scoreboard.',
      'You can feel the pressure—one miss swings the rack.',
      'Huge shot. That is the moment right there.',
      'Tense table now; {player} cannot afford a loose touch.'
    ],
    pot: [
      '{player} pots {targetBall} into {pocket}, cue ball held in good position.',
      'Pot: {targetBall} in {pocket}.',
      '{player} sends {targetBall} down the {pocket} with smooth control.',
      'Lovely pot from {player}; cue ball sits up for the next target.',
      'That is a classy finish—{player} pockets {targetBall} and keeps a natural angle.',
      'Beautiful touch. {player} pockets {targetBall} and keeps options open.',
      'What a shot! {player} drills {targetBall} and stays in line.',
      'No way—did you see that? {player} lands it perfectly.',
      'Unbelievable timing. {player} clears {targetBall} with perfect pace.'
    ],
    combo: [
      '{player} combos {targetBall} into {pocket}, great sighting.',
      'Combination pot on {targetBall} into the {pocket}.',
      '{player} caroms {targetBall} into the {pocket} with precision.',
      'Excellent combo—{player} keeps the cue ball in line for the next look.',
      'That combo was pure class. Clean contact, clean pot.',
      'Brilliant combo—no room for error, and {player} nails it.'
    ],
    bank: [
      '{player} banks {targetBall} into the {pocket} with clean speed.',
      'Bank shot: {targetBall} in the {pocket}.',
      '{player} sends {targetBall} off the cushion and down with control.',
      'Brilliant bank from {player}; that leaves a playable angle.',
      'Top drawer bank shot—touch and pace were spot on.',
      'What a bank! {player} read that perfectly.'
    ],
    kick: [
      'Kick shot required—{player} goes one rail to find it.',
      'Tough kick for {player}; the cue ball needs a thin contact.',
      '{player} escapes with a kick. Excellent table awareness.',
      'This kick has to be perfect—just a sliver of contact.',
      'It is a guessing game now, and {player} needs the right angle.'
    ],
    jump: [
      'Jump cue out—{player} goes airborne to clear the blocker.',
      'That is a confident jump shot from {player}.',
      'Jump shot executed; {player} gets the hit and stays in control.',
      'Bold jump—clean hit and a little bit of flair.',
      'Great timing on the jump; {player} stays in command.'
    ],
    miss: [
      '{player} misses the pot and leaves a look for {opponent}.',
      'No pot for {player}; the table opens up.',
      '{player} comes up short and loses the table.',
      'That is a costly miss—{opponent} will fancy this.',
      'Questionable choice, and it does not pay off.',
      'Oh no, that is a let-off for {opponent}.'
    ],
    foul: [
      'Foul on {player}.',
      'Foul called. {opponent} to the table with control.',
      '{player} commits a foul.',
      'That is a sloppy error, and {opponent} will punish it.',
      'Unforced foul—big swing in momentum.'
    ],
    inHand: [
      'Ball in hand for {opponent}.',
      '{opponent} has ball in hand.',
      'Cue ball in hand for {opponent}.',
      '{opponent} now controls the table with ball in hand.'
    ],
    runout: [
      '{player} is in rhythm—this could be a full clearance.',
      'A runout is on. {player} just needs clean angles and speed control.',
      '{player} is stitching it together, ball by ball.',
      '{player} has the pattern; now it is all about cue-ball placement for the finish.',
      'This is a serious run—{player} looks locked in.',
      '{player} is flowing—every ball is in the right zone.'
    ],
    hillHill: [
      'We are at hill-hill. This is as tense as it gets.',
      'Decider time. One rack for everything.',
      'Final rack nerves—every shot feels heavier now.',
      'Edge-of-the-seat stuff—one rack to decide it.'
    ],
    frameWin: [
      '{player} wins the rack with composed position play.',
      'Rack to {player}.',
      '{player} closes the rack.',
      '{player} takes the rack—clean, calm, and clinical.'
    ],
    matchWin: [
      'Match over. {player} wins {playerScore}-{opponentScore}.',
      '{player} takes the match, {playerScore}-{opponentScore}.',
      'Final score {playerScore}-{opponentScore}. {player} wins.',
      '{player} gets it done. A composed win at {arena}.'
    ],
    tournamentRecall: [
      'Remember, {player} comes in off a {previousResult} result in the previous round—confidence is high.',
      'That last round finished {previousResult}; expect a composed, professional showing.',
      'Carrying momentum from {previousResult}, {player} looks ready for another statement.',
      '{player} arrives off a {previousResult} finish—plenty of belief in the camp.'
    ],
    outro: [
      'That wraps it up from {arena}. Thanks for joining us.',
      'From {arena}, that is full time. Great match tonight.',
      'A fantastic finish in {variantName}. Thanks for watching with us.',
      'We will leave it there from {arena}. Appreciate your company.'
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
    variantName: '8Ball',
    groupCall: [
      'Open table between {groupPrimary} and {groupSecondary}; {player} will claim a set soon.',
      '{groupPrimary} versus {groupSecondary} in 8Ball; the first clean pot sets the route.',
      '8Ball rules in play. {groupPrimary} and {groupSecondary} are both available.'
    ],
    freeBall: [
      'Foul gives {player} ball in hand—huge advantage in 8Ball.',
      'Ball in hand for {player}; they can use it tactically.',
      '8Ball rules apply: ball in hand for {player}.'
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
  it: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        'Benvenuti alla {arena}. {speaker} con voi per {variantName}.',
        'È un piacere avervi con noi alla {arena}. {speaker} in cabina.',
        'Buonasera e benvenuti—{arena} ospita {player} contro {opponent}.'
      ],
      intro: [
        'Benvenuti alla {arena}. {speaker} qui. {player} contro {opponent}; {scoreline} in {variantName}.',
        'È tempo di match alla {arena}. {speaker} con voi. {player} contro {opponent}, {scoreline}.',
        'Buonasera dalla {arena}. {speaker} al commento. {player} e {opponent} sono {playerScore}-{opponentScore}.'
      ],
      introReply: [
        'Grazie {speaker}. Qui conta il controllo della battente e la gestione degli angoli.',
        'Felice di esserci, {speaker}. Nel pool, posizionamento e tempi di gioco fanno la differenza.',
        'Esatto, {speaker}. {player} e {opponent} cercano imbucate pulite con rotazione precisa.'
      ],
      breakShot: [
        '{player} va al break; una buona apertura crea subito opportunità.',
        '{player} prepara il break. Conta il controllo della battente.',
        'Break di {player}. Gestione della battente fondamentale.'
      ],
      breakResult: [
        'Buona apertura, {speaker}. Tavolo aperto con linee chiare.',
        'Break efficace: ora servono precisione e velocità.',
        'Pacco aperto. Si gioca di posizione.'
      ],
      openTable: [
        'Tavolo aperto: {player} cerca angoli naturali e una traiettoria semplice.',
        'Ci sono opzioni; la scelta del prossimo bersaglio è chiave.',
        '{player} legge il tavolo e pianifica il posizionamento.'
      ],
      safety: [
        'Difesa intelligente. {player} nasconde la battente.',
        'Sicurezza misurata: {opponent} è lungo e scomodo.',
        '{player} rinuncia al tiro e protegge il punteggio.'
      ],
      pressure: [
        'Momento pesante. {player} deve imbucare per restare in corsa.',
        'Tiro di pressione: tocco e posizione sono tutto.',
        'Qui si vede il sangue freddo di {player}.'
      ],
      pot: [
        '{player} imbuca {targetBall} in {pocket} e lascia la battente in posizione.',
        'Imbucata netta: {targetBall} in {pocket}.',
        '{player} manda {targetBall} in {pocket} con controllo di battente.',
        'Che imbucata! {player} tiene la battente perfetta per il colpo successivo.'
      ],
      combo: [
        '{player} combina {targetBall} in {pocket}.',
        'Combinazione su {targetBall} in {pocket}.',
        '{player} carambola {targetBall} in {pocket} con precisione.'
      ],
      bank: [
        '{player} di sponda: {targetBall} in {pocket}.',
        'Sponda riuscita: {targetBall} in {pocket}.',
        '{player} manda {targetBall} di sponda con grande controllo.'
      ],
      kick: [
        'Serve una sponda: {player} va di kick.',
        'Kick difficile per {player}; serve contatto sottile.',
        '{player} esce bene con un kick di qualità.'
      ],
      jump: [
        '{player} salta l’ostacolo con un jump.',
        'Jump eseguito con sicurezza da {player}.',
        'Colpo in salto perfetto; {player} resta in controllo.'
      ],
      miss: [
        '{player} manca l’imbucata e lascia il tavolo a {opponent}.',
        'Niente imbucata per {player}; tavolo aperto.',
        '{player} sbaglia e perde l’iniziativa.'
      ],
      foul: [
        'Fallo di {player}.',
        'Fallo: {opponent} torna al tavolo con palla in mano.',
        '{player} commette fallo.'
      ],
      inHand: [
        'Battente in mano per {opponent}.',
        '{opponent} ha palla in mano.',
        'Palla in mano per {opponent}.'
      ],
      runout: [
        '{player} è in ritmo—può chiudere il rack.',
        'C’è il run-out: servono angoli puliti e controllo.',
        '{player} sta costruendo la serie, una palla alla volta.'
      ],
      hillHill: [
        'Siamo al decider: tensione massima.',
        'Rack decisivo. Tutto in un colpo.',
        'Finale al cardiopalma.'
      ],
      frameWin: [
        '{player} vince il rack con grande compostezza.',
        'Rack per {player}.',
        '{player} chiude il rack.'
      ],
      matchWin: [
        'Match finito. {player} vince {playerScore}-{opponentScore}.',
        '{player} conquista il match, {playerScore}-{opponentScore}.',
        'Risultato finale {playerScore}-{opponentScore}. Vince {player}.'
      ],
      tournamentRecall: [
        '{player} arriva da {previousResult} nel round precedente: fiducia alta.',
        'L’ultimo turno è finito {previousResult}; ci aspettiamo una prova di livello.',
        'Con lo slancio di {previousResult}, {player} sembra pronto a un’altra prova solida.'
      ],
      outro: [
        'È tutto dalla {arena}. Grazie per essere stati con noi.',
        'Dalla {arena} è tutto. Che match.',
        'Grande finale in {variantName}. Grazie per l’ascolto.'
      ]
    },
    nineBall: {
      variantName: 'biliardo americano a 9 palle',
      rotation: [
        'Nel 9 palle bisogna colpire sempre la palla con il numero più basso.',
        'Disciplina del 9 palle: prima la palla più bassa.',
        'Rotazione pura: prima la palla più bassa, sempre.'
      ],
      goldenBreak: [
        'Se il 9 entra al break, è break d’oro.',
        'Occhio al 9: può finire subito.',
        'Il 9 al break chiude il rack.'
      ],
      comboNine: [
        '{player} valuta la combinazione sul 9: colpo pesante.',
        'Combinazione sul 9: può chiudere tutto.',
        'Chance di combo sul 9 per {player}.'
      ],
      pushOut: [
        '{player} sceglie il push-out per migliorare la posizione.',
        'Push-out strategico: decisione importante per {opponent}.',
        'Push-out giocato: ora {opponent} deve decidere.'
      ]
    },
    eightBallUs: {
      variantName: '8 palle americano',
      groupCall: [
        'Tavolo aperto tra {groupPrimary} e {groupSecondary}; {player} deve scegliere.',
        '{player} può scegliere {groupPrimary} o {groupSecondary}: il primo pot decide.',
        'Ci sono {groupPrimary} e {groupSecondary} disponibili.'
      ],
      inHand: [
        'Fallo: {opponent} ha palla in mano.',
        '{opponent} con palla in mano—occasione enorme.',
        'Palla in mano per {opponent}: può impostare la serie.'
      ],
      eightBall: [
        'Ora si gioca sull’8.',
        'Tutto passa dall’8.',
        'Palla 8 in gioco: posizione decisiva.'
      ]
    },
    eightBallUk: {
      variantName: '8Ball',
      groupCall: [
        'Regole 8Ball: {groupPrimary} e {groupSecondary} sono aperte.',
        '{player} deve scegliere tra {groupPrimary} e {groupSecondary}.',
        'Tavolo aperto in 8Ball.'
      ],
      freeBall: [
        'Fallo: {player} ha palla in mano.',
        'Palla in mano per {player}; grande vantaggio.',
        '{player} con palla in mano: può impostare la tattica.'
      ],
      blackBall: [
        'Ora la nera è in gioco.',
        'Tutto passa dalla nera.',
        'Palla nera: serve l’angolo perfetto.'
      ]
    }
  },
  zh: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        '欢迎来到{arena}。{speaker}为您带来解说。',
        '{arena}现场，{speaker}与您一同见证比赛。',
        '大家好，欢迎来到{arena}。'
      ],
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
      tournamentRecall: [
        '{player}上一轮以{previousResult}结束，状态正佳。',
        '上一轮比分为{previousResult}，期待更专业的发挥。'
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
      variantName: '8Ball',
      groupCall: ['8Ball规则，{groupPrimary}与{groupSecondary}等待归属。'],
      freeBall: ['{player}获得自由球，拥有球权优势。'],
      blackBall: ['黑球上台，角度要求很高。']
    }
  },
  hi: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        '{arena} से स्वागत है। {speaker} आपके साथ हैं।',
        '{arena} में आपका स्वागत है—{speaker} कॉमेंट्री में हैं।',
        'नमस्कार, {arena} से आपका स्वागत है।'
      ],
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
      tournamentRecall: [
        '{player} पिछला राउंड {previousResult} से जीत कर आ रहे हैं।',
        'पिछला राउंड {previousResult} रहा—उम्मीदें ऊँची हैं।'
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
      variantName: '8Ball',
      groupCall: ['8Ball नियमों में {groupPrimary} और {groupSecondary} खुले हैं।'],
      freeBall: ['{player} को बॉल इन हैंड मिलती है।'],
      blackBall: ['ब्लैक बॉल आ गई, एंगल बहुत जरूरी है।']
    }
  },
  es: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        'Bienvenidos a {arena}. {speaker} con ustedes.',
        'Un placer tenerlos en {arena}. {speaker} en cabina.',
        'Hola a todos, bienvenidos a {arena}.'
      ],
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
      tournamentRecall: [
        '{player} viene de {previousResult} en la ronda anterior.',
        'La última ronda terminó {previousResult}; esperamos una actuación de nivel.'
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
      variantName: '8Ball',
      groupCall: ['Reglas 8Ball: {groupPrimary} y {groupSecondary} aún abiertos.'],
      freeBall: ['{player} tiene bola en mano.'],
      blackBall: ['La negra está en juego; el ángulo es clave.']
    }
  },
  fr: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        'Bienvenue à {arena}. {speaker} avec vous.',
        'Ravi de vous avoir à {arena}. {speaker} en cabine.',
        'Bonsoir et bienvenue—{arena} accueille {player} contre {opponent}.'
      ],
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
      tournamentRecall: [
        '{player} arrive après {previousResult} au tour précédent.',
        'Le tour précédent s’est terminé {previousResult}; on attend une prestation solide.'
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
      variantName: '8Ball',
      groupCall: ['Règles 8Ball: {groupPrimary} et {groupSecondary} sont ouverts.'],
      freeBall: ['{player} a une bille en main.'],
      blackBall: ['La noire est en jeu; l’angle compte.']
    }
  },
  ar: {
    ...ENGLISH_TEMPLATES,
    common: {
      welcome: [
        'مرحبًا بكم في {arena}. {speaker} معكم.',
        'أهلًا بكم في {arena}. {speaker} يرافقكم.',
        'أهلًا وسهلًا بكم في {arena}.'
      ],
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
      tournamentRecall: [
        '{player} يأتي بعد {previousResult} في الجولة السابقة.',
        'الجولة الماضية انتهت {previousResult}؛ ننتظر أداءً احترافيًا.'
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
      variantName: '8Ball',
      groupCall: ['قواعد 8Ball: {groupPrimary} و{groupSecondary} مفتوحة.'],
      freeBall: ['{player} يحصل على كرة في اليد.'],
      blackBall: ['الكرة السوداء في اللعب؛ الزاوية مهمة جدًا.']
    }
  },
  sq: {
    common: {
      welcome: [
        'Mirë se vini në {arena}. {speaker} me ju për {variantName}.',
        'Përshëndetje nga {arena}—{speaker} në komentim.',
        'Tungjatjeta, {arena} është gati për {player} kundër {opponent}.',
        'Mirëmbrëma nga {arena}. Sot {player} kundër {opponent}.'
      ],
      intro: [
        'Mirë se vini në {arena}. {speaker} me ju. {player} përballë {opponent}; {scoreline} në {variantName}.',
        'Mbrëmje e mirë nga {arena}. {speaker} në komentim. {player} kundër {opponent}, {scoreline}.',
        '{arena} është skena—{player} dhe {opponent} në {variantName}, {scoreline}.'
      ],
      introReply: [
        'Faleminderit, {speaker}. Kontrolli i topit të bardhë dhe pozicionimi vendosin gjithçka.',
        'Kënaqësi të jem këtu, {speaker}. Fiton ai që menaxhon këndet.',
        'Saktë, {speaker}. Qetësia dhe ritmi janë vendimtarë.'
      ],
      breakShot: [
        '{player} gati për thyerjen; shpërndarje e pastër dhe top i bardhë i qetë.',
        '{player} hyn për thyerje—shpejtësia dhe kontrolli janë kyç.',
        'Ja thyerja nga {player}; të shohim si hapen topat.'
      ],
      breakResult: [
        'Thyerje e mirë—tavolina është hapur.',
        'Topat u shpërndanë bukur; ka linja të pastra.',
        'Shpërndarje solide, tani rëndësi ka pozicionimi.'
      ],
      openTable: [
        'Tavolina e hapur; {player} kërkon rrugë të thjeshta.',
        '{player} po lexon këndet dhe zonën e ndalimit.',
        'Shumë opsione—gjithçka varet nga kontrolli i topit të bardhë.',
        'Këndi i ardhshëm është çelësi; {player} duhet të ulet mirë.'
      ],
      safety: [
        'Siguri e mençur; {player} fsheh topin e bardhë.',
        'Zgjedhje taktike, e lë {opponent} në pozicion të vështirë.',
        'S’më bind plotësisht kjo siguri—ka rrezik të mbetet hapur.',
        'Siguri e pastër; i prish ritmin kundërshtarit.'
      ],
      pressure: [
        'Moment me presion; {player} duhet të jetë i saktë.',
        'Goditje e madhe—mënyra si e prek topin vendos gjithçka.',
        'Tension i lartë; një gabim këtu kushton.',
        'Kjo është goditje që ndan fituesin.'
      ],
      pot: [
        'Çfarë goditje! {player} fut {targetBall} në {pocket}.',
        'E pabesueshme—{player} e fut dhe mban pozicion.',
        '{player} fut {targetBall} në {pocket}, topi i bardhë qëndron bukur.',
        'Goditje e pastër; {player} lë kënd të mirë për tjetrin.',
        'Shkëlqyeshëm! {player} e mbyll me kontroll.',
        'Super prekje—{player} fut {targetBall} dhe ruan ritmin.'
      ],
      combo: [
        'Kombinim i saktë—{player} fut {targetBall} në {pocket}.',
        'Kombinim i bukur; {player} e sheh linjën.',
        'Kjo ishte e vështirë, por e saktë!'
      ],
      bank: [
        'Goditje nga banda—{player} fut {targetBall} në {pocket}.',
        'Goditje nga banda dhe topi bie; bravo!',
        'Goditje nga banda e pastër; kënd i kontrolluar.'
      ],
      kick: [
        'Goditje me bankë e detyruar—{player} kërkon kontaktin.',
        'Duhet bankë për të prekur topin.',
        'Goditje me rrezik, por duhet ta prekë.'
      ],
      jump: [
        'Goditje kërcimi e pastër—{player} kalon bllokimin.',
        'Goditje kërcimi; topi u gjet.',
        'Kërcim i guximshëm dhe i saktë.'
      ],
      miss: [
        'Ah, e humbi; shans i artë për {opponent}.',
        'Kjo s’ishte e mirë—gabim i kushtueshëm.',
        'Zgjedhje e dyshimtë dhe nuk paguan.',
        'E humbi dhe tavolina hapet.',
        'Jo, jo! {opponent} merr një dhuratë.'
      ],
      foul: [
        'Faull nga {player}.',
        'Gabim i panevojshëm—{opponent} merr avantazh.',
        'Faull i rëndë; kjo mund të kthejë lojën.',
        'Gabim teknik, {opponent} në tavolinë.'
      ],
      inHand: [
        '{opponent} ka top në dorë.',
        'Top në dorë për {opponent}—mundësi e madhe.',
        '{opponent} merr kontrollin me topin në dorë.'
      ],
      runout: [
        '{player} është në seri—mund ta pastrojë tavolinën.',
        'Ritëm i bukur; po shkon drejt mbylljes.',
        '{player} ka planin; i duhet vetëm një pozicion i pastër.',
        'Kjo duket si pastrim tavoline nëse nuk gabon.'
      ],
      hillHill: [
        'Frejmi vendimtar—tension maksimal.',
        'Gjithçka në një frejm; nervat janë test.',
        'Momenti i madh—një goditje e ndryshon ndeshjen.'
      ],
      frameWin: [
        '{player} fiton frejmin.',
        'Frejm për {player}.',
        'Mbyllje e qetë nga {player}.'
      ],
      matchWin: [
        'Ndeshja mbyllet. {player} fiton {playerScore}-{opponentScore}.',
        '{player} e merr ndeshjen, {playerScore}-{opponentScore}.',
        'Fitore finale për {player}.'
      ],
      tournamentRecall: [
        '{player} vjen pas {previousResult} në raundin e kaluar—formë e lartë.',
        'Raundi i fundit përfundoi {previousResult}; pritshmëri të mëdha.',
        'Me momentum nga {previousResult}, {player} duket gati.'
      ],
      outro: [
        'Kaq nga {arena}. Faleminderit që ishit me ne.',
        'Nga {arena}, ju falënderojmë për shoqërinë.',
        'Mbyllim këtu; faleminderit për ndjekjen.'
      ]
    },
    nineBall: {
      variantName: '9-boll amerikan',
      rotation: [
        'Në 9-boll duhet goditur gjithmonë topi më i vogël.',
        'Rregulli i parë: topi më i ulët, gjithmonë.',
        'Topi më i vogël është i pari—disiplinë 9-boll.'
      ],
      goldenBreak: [
        'Nëse 9-shi bie në thyerje, mbaron menjëherë.',
        'Thyerje e artë nëse 9-shi bie direkt.',
        'Kujdes 9-shin—thyerja mund ta mbyllë.'
      ],
      comboNine: [
        '{player} sheh kombinimin për 9—rrezik i madh.',
        'Kombinim për 9—shans i madh nëse hyn.',
        '9-shi me kombinim? Ky është moment i madh.'
      ],
      pushOut: [
        '{player} luan push-out për një pozicion më të mirë.',
        'Push-out taktik për të krijuar një linjë të pastër.',
        'Push-out—tani {opponent} duhet të vendosë.'
      ]
    },
    eightBallUs: {
      variantName: '8-boll amerikan',
      groupCall: [
        'Tavolinë e hapur; {groupPrimary} ose {groupSecondary} janë në lojë.',
        'Zgjedhja e grupit vendoset me potin e parë.',
        'Grupet janë të hapura—{player} duhet të zgjedhë.'
      ],
      inHand: [
        'Faulli i jep {opponent} top në dorë—shans i madh.',
        '{opponent} me top në dorë; avantazh i qartë.',
        'Top në dorë për {opponent}—mund të nisë seri.'
      ],
      eightBall: [
        'Tani 8-shi është në lojë; pozicioni është gjithçka.',
        'Gjithçka kalon te 8-shi nga këtu.',
        '8-shi në lojë—një gabim e mbyll.'
      ]
    },
    eightBallUk: {
      variantName: '8Ball',
      groupCall: [
        'Rregullat 8Ball: {groupPrimary} dhe {groupSecondary} janë të hapura.',
        'Rregullat 8Ball—grupet janë të lira për momentin.',
        '{groupPrimary} ose {groupSecondary}; poti i parë e vendos.'
      ],
      freeBall: [
        'Top në dorë për {player}.',
        '{player} merr top në dorë—avantazh i madh.',
        'Top në dorë; {player} ka shans të artë.'
      ],
      blackBall: [
        'Topi i zi në lojë; kërkohet kënd i përsosur.',
        'Tani është topi i zi—qetësi dhe precizion.',
        'Topi i zi vendos gjithçka.'
      ]
    }
  }
});

const EVENT_POOLS = Object.freeze({
  welcome: 'welcome',
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
  tournamentRecall: 'tournamentRecall',
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

const applyGreeting = (line, languageKey) => {
  const greetings = GREETING_PREFIXES[languageKey] || GREETING_PREFIXES.en;
  const greeting = pickRandom(greetings || GREETING_PREFIXES.en);
  return `${greeting} ${line}`.trim();
};

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
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('sq')) return 'sq';
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
  const languageKey = resolveLanguageKey(language);
  const templates = LOCALIZED_TEMPLATES[languageKey] || ENGLISH_TEMPLATES;
  const resolvedVariant = resolveVariantData(variant, templates);
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...(LOCALIZED_CONTEXT[languageKey] || {}),
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

  const baseLine = applyTemplate(pickRandom(eventPool), mergedContext);
  if (event === EVENT_POOLS.welcome) {
    return applyGreeting(baseLine, languageKey);
  }
  return baseLine;
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

/** Local single-player content. No leaderboard, wallet, or ordinary Career save access. */
export const BATTLE_CAREER_STORAGE_KEY = 'tonplaygram.kartroyale.battle-career.v1';
export const BATTLE_RANKS = Object.freeze([
  ['rookie', 'Rookie', 0], ['challenger', 'Street Racer', 1000],
  ['street-pro', 'Pro Driver', 3000], ['elite', 'Elite Racer', 7000],
  ['champion', 'Master', 15000], ['legend', 'King of Tirana', 30000],
].map(([id, title, minXp]) => Object.freeze({ id, title, minXp })));

// Formats use arcade-only rules; this metadata does not create a playable mode.
export const BATTLE_FORMATS = Object.freeze({
  classic: Object.freeze({ title: 'Classic' }),
  'combat-arcade': Object.freeze({ title: 'Combat Arcade' }),
  'last-kart-standing': Object.freeze({ title: 'Last Kart Standing' }),
  boss: Object.freeze({ title: 'Boss 1v1' }),
  'police-pursuit-arcade': Object.freeze({ title: 'Police Pursuit Arcade' }),
  drift: Object.freeze({ title: 'Drift' }),
  elimination: Object.freeze({ title: 'Elimination', intervalSeconds: 30 }),
});

const styledFormats = Object.freeze({
  'ali-demi-03': 'police-pursuit-arcade', 'kombinat-03': 'combat-arcade',
  'blloku-06': 'elimination', 'astir-06': 'combat-arcade',
  'laprake-03': 'police-pursuit-arcade', 'dajti-06': 'last-kart-standing',
  'capital-06': 'last-kart-standing', 'capital-07': 'elimination',
});

const crewStyles = Object.freeze({
  'ali-demi': 'precizion dhe mbrojtje në kthesa',
  kombinat: 'qëndrueshmëri dhe ritëm konstant',
  blloku: 'drift teknik dhe gara nate',
  astir: 'përshpejtim dhe sprint',
  laprake: 'kundërsulm garash dhe rikthim nga prapa',
  dajti: 'manovrim e kontroll në pjerrësi',
  capital: 'balancë dhe përshtatje ndaj çdo formati',
});

// Each crew has its own story, route, mission names, requirements, and signature duel.
const crewRows = [
  ['ali-demi', 'Ali Demi Warriors', 'tirana-brryli', 'Luan “Bryli”', 'Të matin me saktësi, jo me famë.', [
    ['Vija e parë', 'race'], ['Kthesa te ura', 'drift'], ['Ritmi i lagjes', 'checkpoint'],
    ['Era anësore', 'time'], ['Tri porta të pastra', 'clean'], ['Kalimi te semafori', 'race'],
    ['Sprinti i Brylit', 'time'], ['Dueli i urës', 'boss'],
  ]],
  ['kombinat', 'Kombinat Steel', 'tirana-kastriot-feska', 'Mali “Çeliku”', 'Mjeshtrat e garazhit nuk falin frenim të vonuar.', [
    ['Turni i dytë', 'race'], ['Shenjat e fabrikës', 'checkpoint'], ['Trajektorja e çelikut', 'time'],
    ['Pa prekur bordurën', 'clean'], ['Kthesa e presës', 'drift'], ['Dalja nga uzina', 'checkpoint'],
    ['Ora e garazhit', 'time'], ['Dueli i çelikut', 'boss'],
  ]],
  ['blloku', 'Blloku Elite', 'tirana-sulejman-delvina', 'Rina “Neon”', 'Garojnë nën drita dhe fitojnë falë ritmit.', [
    ['Dritat e para', 'checkpoint'], ['Rrotullimi neon', 'drift'], ['Hyrja e vonë', 'time'],
    ['Vija e natës', 'clean'], ['Panorama e Bllokut', 'race'], ['Tri xhiro pas mesnate', 'time'],
    ['Kthesa e artë', 'drift'], ['Dueli nën drita', 'boss'],
  ]],
  ['astir', 'Astir Nitro', 'tirana-shqiponja', 'Bora “Nitro”', 'Një start i shpejtë s’vlen pa finish të kontrolluar.', [
    ['Starti i Astirit', 'race'], ['Sprinti i pakthyer', 'time'], ['Harqet e Shqiponjës', 'checkpoint'],
    ['Pa lënë gjurmë', 'clean'], ['Kap ritmin', 'drift'], ['Nitro në fund', 'race'],
    ['Porta e shtatë', 'checkpoint'], ['Dueli i impulsit', 'boss'],
  ]],
  ['laprake', 'Laprakë Ghosts', 'tirana-don-bosko', 'Ergi “Hija”', 'Sfida e tyre është ta lexosh kthesën para se ta shohësh.', [
    ['Hija e parë', 'time'], ['Kalimi i heshtur', 'clean'], ['Shenjat e natës', 'checkpoint'],
    ['Xhiro pa zhurmë', 'drift'], ['Dy vijat e kthesës', 'race'], ['Sekonda e fundit', 'time'],
    ['Ritmi i hijes', 'clean'], ['Dueli i hijes', 'boss'],
  ]],
  ['dajti', 'Dajti Titans', 'tirana-riza-abazi', 'Dori “Maja”', 'Ekipi i shpatit kërkon saktësi edhe nën presion.', [
    ['Në drejtim të majës', 'race'], ['Flladi i parë', 'clean'], ['Portat e shpatit', 'checkpoint'],
    ['Qafa e kthesave', 'drift'], ['Zbritja e shpejtë', 'time'], ['Dy vija përpjetë', 'race'],
    ['Pika më e lartë', 'checkpoint'], ['Dueli i majës', 'boss'],
  ]],
  ['capital', 'Capital Kings', 'tirana-zogu-pare', 'Alba “Kurora”', 'Finalja bashkon ritmin, saktësinë dhe guximin e të gjitha lagjeve.', [
    ['Hyrja në qendër', 'race'], ['Portat e kryeqytetit', 'checkpoint'], ['Përtej podiumit', 'clean'],
    ['Shpejtësia e kurorës', 'time'], ['Kthesa e kampionit', 'drift'], ['Fundi i epokës', 'race'],
    ['Kualifikimi i madh', 'time'], ['Dueli për kurorën', 'boss'],
  ]],
];

// Tuning only. A runtime adapter must verify each mission's official course and scoring.
function criteriaFor(kind, crewIndex, stepIndex) {
  switch (kind) {
    case 'boss': return { maxPlace: 1, opponents: 1 };
    case 'race': return { maxPlace: crewIndex < 3 ? 3 : 2, opponents: 5 };
    case 'drift': return { minDriftPoints: 180 + crewIndex * 100 + stepIndex * 20 };
    case 'checkpoint': return { minCheckpoints: 3 + crewIndex + stepIndex };
    case 'time': return { maxTimeSeconds: 150 - crewIndex * 4 - stepIndex * 3 };
    case 'clean': return { maxCollisions: crewIndex > 3 ? 0 : 1 };
    default: throw new Error('Unknown Battle Career rule');
  }
}

let previous = null;
export const BATTLE_CREWS = Object.freeze(crewRows.map(([id, title, courseId, boss, intro, rows], crewIndex) => {
  const missions = rows.map(([title, kind], stepIndex) => {
    const missionId = `${id}-${String(stepIndex + 1).padStart(2, '0')}`;
    const format = styledFormats[missionId] ?? (kind === 'boss' || kind === 'drift' ? kind : 'classic');
    const mission = {
      format, id: missionId, crewId: id, courseId, title, kind, prerequisite: previous,
      xpAward: kind === 'boss' ? 1300 + crewIndex * 130 : 350 + crewIndex * 75 + stepIndex * 25,
      criteria: Object.freeze(criteriaFor(kind, crewIndex, stepIndex)),
      readiness: 'content-only',
      ...(kind === 'boss' ? { rivalName: boss } : {}),
    };
    previous = missionId;
    return Object.freeze(mission);
  });
  return Object.freeze({ id, title, courseId, boss, intro, style: crewStyles[id], missions: Object.freeze(missions) });
}));
const missions = BATTLE_CREWS.flatMap(({ missions }) => missions);
const missionsById = new Map(missions.map((mission) => [mission.id, mission]));
export const getBattleMission = (id) => missionsById.get(id);
export const getBattleCareerRank = (xp) => {
  const validXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return BATTLE_RANKS.findLast((rank) => validXp >= rank.minXp);
};

// Progress saves IDs, not XP claims from outside the campaign. Ignore gaps/unknown IDs.
export function normalizeBattleCareerProgress(input) {
  const claimed = new Set(input?.version === 1 && Array.isArray(input.completedMissionIds)
    ? input.completedMissionIds : []);
  const completedMissionIds = [];
  let xp = 0;
  for (const mission of missions) {
    if (!claimed.has(mission.id)) break;
    completedMissionIds.push(mission.id);
    xp += mission.xpAward;
  }
  return { version: 1, completedMissionIds, xp };
}

export function getBattleMissionStatus(id, input) {
  const mission = getBattleMission(id);
  if (!mission) return 'missing';
  const { completedMissionIds } = normalizeBattleCareerProgress(input);
  if (completedMissionIds.includes(id)) return 'completed';
  return !mission.prerequisite || completedMissionIds.includes(mission.prerequisite) ? 'available' : 'locked';
}

function met(mission, result) {
  if (!result || result.finished !== true || result.courseId !== mission.courseId
    || result.format !== mission.format) return false;
  switch (mission.format) {
    case 'combat-arcade': if (result.arcadeObjectiveCompleted !== true) return false; break;
    case 'last-kart-standing': if (result.remainingKarts !== 1 || result.place !== 1) return false; break;
    case 'police-pursuit-arcade': if (result.pursuitCompleted !== true) return false; break;
    case 'elimination': if (result.eliminationIntervalSeconds !== BATTLE_FORMATS.elimination.intervalSeconds
      || result.remainingKarts !== 1 || result.place !== 1) return false; break;
  }
  for (const [key, limit] of Object.entries(mission.criteria)) {
    switch (key) {
      case 'maxPlace': if (!Number.isInteger(result.place) || result.place < 1 || result.place > limit) return false; break;
      case 'opponents': if (result.opponents !== limit) return false; break;
      case 'minDriftPoints': if (!Number.isFinite(result.driftPoints) || result.driftPoints < limit) return false; break;
      case 'minCheckpoints': if (!Number.isInteger(result.checkpoints) || result.checkpoints < limit) return false; break;
      case 'maxTimeSeconds': if (!Number.isFinite(result.seconds) || result.seconds <= 0 || result.seconds > limit) return false; break;
      case 'maxCollisions': if (!Number.isInteger(result.collisions) || result.collisions < 0 || result.collisions > limit) return false; break;
      default: return false;
    }
  }
  return true;
}

export function recordBattleCareerResult(input, id, result, verifiedMissionIds = []) {
  const progress = normalizeBattleCareerProgress(input);
  const mission = getBattleMission(id);
  if (!mission || getBattleMissionStatus(id, progress) !== 'available') return { progress, xpAward: 0, accepted: false };
  if (!verifiedMissionIds.includes(id) || !met(mission, result)) return { progress, xpAward: 0, accepted: false };
  return {
    progress: { ...progress, completedMissionIds: [...progress.completedMissionIds, id], xp: progress.xp + mission.xpAward },
    xpAward: mission.xpAward, accepted: true,
  };
}

export function readBattleCareer(storage) {
  try { return normalizeBattleCareerProgress(JSON.parse(storage.getItem(BATTLE_CAREER_STORAGE_KEY) || 'null')); }
  catch { return normalizeBattleCareerProgress(null); }
}

export function saveBattleCareer(storage, progress) {
  try {
    storage.setItem(BATTLE_CAREER_STORAGE_KEY, JSON.stringify(normalizeBattleCareerProgress(progress)));
    return true;
  } catch { return false; }
}

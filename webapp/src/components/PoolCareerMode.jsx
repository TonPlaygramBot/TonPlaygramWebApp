import { useEffect, useMemo, useState } from 'react';
import { getAvatarUrl, loadAvatar } from '../utils/avatarUtils.js';
import { getTelegramPhotoUrl } from '../utils/telegram.js';

const PROGRESS_KEY = 'pool_career_progress';

const CAREER_TASKS = [
  {
    level: 1,
    title: 'Stance Fundamentals',
    description:
      'Adopto pozicion të qëndrueshëm, gjerësia e shpatullave, dhe punoni me një goditje të ulët mbi vijën e objektivit.'
  },
  {
    level: 2,
    title: 'Bridge Control',
    description:
      'Ndërto një bridge të mbyllur të qëndrueshme 10 herë rresht pa lëvizur dorën e qëndrueshmërisë.'
  },
  {
    level: 3,
    title: 'Straight-Line Drill',
    description:
      'Qit 10 topa në vijë të drejtë me qëndrim qendror pa humbur kontrollin e shenjimit.'
  },
  {
    level: 4,
    title: 'Stop Shot Basics',
    description:
      'Ekzekuto 5 stop-shots radhazi duke ndalur topin e bardhë pa rrëshqitje të panevojshme.'
  },
  {
    level: 5,
    title: 'Soft Draw Calibration',
    description: 'Rikthe topin e bardhë 15–20 cm në 5 tentativa duke ruajtur vijën e goditjes.'
  },
  {
    level: 6,
    title: 'Follow-Through Control',
    description:
      'Çoje topin e bardhë përpara 20–30 cm në 5 tentativa për të krijuar ndjekje të butë kontrolli.'
  },
  {
    level: 7,
    title: 'Ghost Ball Visualization',
    description:
      'Vizualizo dhe marko pikën ghost-ball në 5 gjuajtje të thjeshta për të saktësuar këndet.'
  },
  {
    level: 8,
    title: 'Center Ball Only',
    description:
      'Luaj 10 goditje vetëm me qendër të topit për të stabilizuar drejtimin dhe ritmin.'
  },
  {
    level: 9,
    title: 'Long Pot Confidence',
    description:
      'Shëno 3 goditje të gjata në diagonale me shpejtësi të moderuar pa prekur bandat.'
  },
  {
    level: 10,
    title: 'Basic Safety Roll',
    description:
      'Kryej një goditje sigurie duke lënë topin e bardhë pas një tope për mbulim të thjeshtë.'
  },
  {
    level: 11,
    title: 'Controlled Break-Off',
    description:
      'Simulo një break-off të butë: përplase bandën kryesore dhe sill topin e bardhë në anën e kundërt.'
  },
  {
    level: 12,
    title: 'Angle Perception',
    description:
      'Vendos 5 gjuajtje në kënde 30°–45° dhe shëno të paktën 3 për të matur perceptimin.'
  },
  {
    level: 13,
    title: 'Speed Ladders',
    description:
      'Luaj 5 goditje me shpejtësi të ndryshme duke u ndalur në zona të shënuara 3, 4 dhe 5 këllograme.'
  },
  {
    level: 14,
    title: 'Rail Drags',
    description: 'Qit 3 goditje nga banda duke mbajtur linjën e ndjekjes paralele me rail-in.'
  },
  {
    level: 15,
    title: 'Two-Ball Position',
    description:
      'Poziciono topin e bardhë për goditjen pasuese në 5 skema të ndryshme dy-topëshe.'
  },
  {
    level: 16,
    title: 'Natural Angles',
    description:
      'Shfrytëzo këndet natyrale për të kaluar nga një top në tjetrin në 3 pattern bazike.'
  },
  {
    level: 17,
    title: 'Stop-Draw Blend',
    description:
      'Kombino stop dhe draw në një seri me 3 topa për të mbajtur linjën e pozicionit.'
  },
  {
    level: 18,
    title: 'Follow to Rail',
    description:
      'Dërgo topin e bardhë në bandë dhe rikthe në zonën e kontrolluar në 3 tentativa.'
  },
  {
    level: 19,
    title: 'Safety Containment',
    description:
      'Vendos një goditje sigurie duke lënë distancë të gjatë dhe topin e bardhë në rail.'
  },
  {
    level: 20,
    title: 'Three-In-A-Row Potting',
    description:
      'Shëno 3 topa rresht në pozicione të ndryshme pa humbur kontrollin e ritmit.'
  },
  {
    level: 21,
    title: 'Closed Bridge Break',
    description:
      'Përdor bridge të mbyllur për një mini-break me 4 tope duke ruajtur stabilitetin.'
  },
  {
    level: 22,
    title: 'Stun Run-Through',
    description:
      'Ekzekuto një stun-shot që e çon topin e bardhë në 30–40 cm përpara pa devijim.'
  },
  {
    level: 23,
    title: 'Half-Ball Mastery',
    description:
      'Godit 5 goditje half-ball me qasje të njëtrajtshme për të matur ngjitjen në bandë.'
  },
  {
    level: 24,
    title: 'Rail First Safety',
    description:
      'Shëno një goditje sigurie duke përdorur rail-in për të fshehur topin e bardhë pas një grumbulli.'
  },
  {
    level: 25,
    title: 'Side-Spin Entry',
    description:
      'Apliko left dhe right english në dy goditje për të parë diferencën e këndit të rikthimit.'
  },
  {
    level: 26,
    title: 'Ladder Run',
    description:
      'Shëno një seri me 5 tope të rreshtuara në diagonal duke lëvizur topin e bardhë në zone të kontrolluara.'
  },
  {
    level: 27,
    title: 'Two-Rail Position',
    description:
      'Përdor dy banda për të sjellë topin e bardhë në cepin e kundërt në 3 skema.'
  },
  {
    level: 28,
    title: 'Kick Escape',
    description:
      'Dil nga snooker me një kick-shot duke prekur bandën dhe objektivin brenda dy tentativave.'
  },
  {
    level: 29,
    title: 'Mini Clearance',
    description:
      'Pastro 4 tope të shpërndara pa gabim duke ruajtur pozicionin për secilën goditje.'
  },
  {
    level: 30,
    title: 'Safety to Offense Switch',
    description:
      'Luaj një goditje sigurie dhe shndërroje menjëherë në ofensivë kur kundërshtari lë rast.'
  },
  {
    level: 31,
    title: 'Power Break Control',
    description:
      'Realizo një break më të fortë duke ruajtur kontrollin e topit të bardhë në qendër të tavolinës.'
  },
  {
    level: 32,
    title: 'Three-Rail Positioning',
    description:
      'Përdor 3 banda për të sjellë topin e bardhë në zonë të ngushtë në 3 pattern të ndryshme.'
  },
  {
    level: 33,
    title: 'Side-Pocket Mastery',
    description:
      'Shëno 4 topa në qeset anësore duke mbajtur kontrollin e shpejtësisë.'
  },
  {
    level: 34,
    title: 'Force-Follow Stroke',
    description:
      'Apliko force-follow për të kaluar një grup topash pa humbur linjën e pozicionit.'
  },
  {
    level: 35,
    title: 'Draw to Zone',
    description:
      'Rikthe topin e bardhë në një zonë 10×10 cm në 4 skema të ndryshme.'
  },
  {
    level: 36,
    title: 'Break and Clear Mini-Rack',
    description:
      'Bëj një mini-break prej 20 pikësh duke pastruar një set të shpërndarë topash.'
  },
  {
    level: 37,
    title: 'Advanced Safeties',
    description:
      'Lë topin e bardhë në linjë të vështirë me distancë të gjatë dhe mbulim pas bande dy herë rresht.'
  },
  {
    level: 38,
    title: 'Kiss Avoidance',
    description:
      'Planifiko 3 gjuajtje duke shmangur kontaktet e padëshiruara (kisses) me topa të tjerë.'
  },
  {
    level: 39,
    title: 'Pattern Precision',
    description:
      'Zgjidh një layout me 6 tope dhe pastroje me 0 gabime në pozicionim.'
  },
  {
    level: 40,
    title: 'Time-Boxed Run',
    description:
      'Pastro 5 tope nën presion kohe 60 sekondëshe duke mbajtur saktësi.'
  },
  {
    level: 41,
    title: 'Break Under Pressure',
    description:
      'Simulo break me kufizim kohe dhe stabilizo topin e bardhë në qendër 3 herë rresht.'
  },
  {
    level: 42,
    title: 'Three-Cushion Escape',
    description:
      'Dil nga një snooker duke përdorur tre banda në më pak se dy tentativa.'
  },
  {
    level: 43,
    title: 'Precision Massé',
    description:
      'Kryej një massé të kontrolluar për të anashkaluar një pengesë pa prekur topa të tjerë.'
  },
  {
    level: 44,
    title: 'Jump Control',
    description:
      'Realizo një jump-shot të ulët me objektiv të qartë dhe distancë uljeje të kontrolluar.'
  },
  {
    level: 45,
    title: 'Safety Tree Planning',
    description:
      'Planifiko 3 opsione sigurie për të njëjtin layout dhe zgjedh zgjidhjen më të mirë sipas riskut.'
  },
  {
    level: 46,
    title: 'Extended Clearance',
    description:
      'Pastro 8 tope të shpërndara duke ruajtur linjën për break të mundshëm.'
  },
  {
    level: 47,
    title: 'Two-Way Shot Design',
    description:
      'Krijo një goditje që ofron shans shënimi dhe mbulim sigurie në të njëjtën kohë.'
  },
  {
    level: 48,
    title: 'Pro Pattern Marathon',
    description:
      'Lidho 10 goditje rresht me spin të miksuar dhe pa humbur kontrollin e topit të bardhë.'
  },
  {
    level: 49,
    title: 'Safety Duel',
    description:
      'Simulo duel sigurie 5-shkëmbyese ku çdo kthesë duhet të lërë kundërshtarin pa kënd.'
  },
  {
    level: 50,
    title: 'Champion’s Run',
    description:
      'Break, kontrollo cluster-in, pastro 10+ tope nën kohëmatës dhe përfundo me një mbulim perfekt.'
  }
];

function rewardForLevel(level) {
  if (level === 50) return 2000;
  if (level >= 41) return 400;
  if (level >= 31) return 300;
  if (level >= 21) return 200;
  if (level >= 11) return 200;
  return 100;
}

function giftForLevel(level) {
  if (level === 50) return 'Special NFT + 2000 TPC';
  if (level % 10 === 0) return 'Milestone NFT Gift';
  return null;
}

export default function PoolCareerMode() {
  const [completed, setCompleted] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem(PROGRESS_KEY);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    } catch {}
    return new Set();
  });

  const playerBadge = useMemo(() => {
    const saved = loadAvatar();
    const src = getAvatarUrl(saved) || getTelegramPhotoUrl();
    if (!src) return null;
    return src;
  }, []);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completed]));
  }, [completed]);

  const toggleLevel = (level) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const totalTpc = useMemo(
    () =>
      CAREER_TASKS.reduce((sum, task) => {
        return completed.has(task.level) ? sum + rewardForLevel(task.level) : sum;
      }, 0),
    [completed]
  );

  const completedCount = completed.size;

  return (
    <section className="space-y-3 bg-surface border border-border rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtext">Career Mode</p>
          <h3 className="text-lg font-semibold">50 Round Mastery</h3>
          <p className="text-sm text-subtext">
            Përparoni nga bazat në nivelin pro. Çdo 10 nivele sjellin një NFT dhuratë dhe
            rritje të fitimeve TPC.
          </p>
        </div>
        {playerBadge ? (
          <img
            src={playerBadge}
            alt="Player badge"
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="lobby-tile px-3 py-1">
          {completedCount}/50 përfunduar
        </span>
        <span className="lobby-tile px-3 py-1">TPC të mbledhura: {totalTpc}</span>
        <span className="lobby-tile px-3 py-1">NFT milestones: 5 + speciale finale</span>
      </div>
      <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
        {CAREER_TASKS.map((task) => {
          const reward = rewardForLevel(task.level);
          const gift = giftForLevel(task.level);
          const isDone = completed.has(task.level);
          return (
            <div
              key={task.level}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                isDone ? 'border-emerald-400 bg-emerald-900/20' : 'border-border bg-surface'
              }`}
            >
              <button
                onClick={() => toggleLevel(task.level)}
                className={`mt-1 h-5 w-5 rounded-full border flex items-center justify-center text-xs font-semibold ${
                  isDone
                    ? 'bg-emerald-500 border-emerald-500 text-background'
                    : 'bg-background border-border text-subtext'
                }`}
                aria-label={`Mark level ${task.level} as ${isDone ? 'incomplete' : 'complete'}`}
              >
                {isDone ? '✓' : task.level}
              </button>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold">Lvl {task.level} · {task.title}</p>
                    <p className="text-xs text-subtext leading-snug">{task.description}</p>
                  </div>
                  <div className="flex flex-col items-end text-xs">
                    <span className="font-semibold">{reward} TPC</span>
                    {gift ? (
                      <span className="text-primary font-semibold">{gift}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Fictional campaign briefs. A brief is never a claim that a runtime mission is implemented. */
export const STORY_FACTIONS = {
  shqiponjat: { title: 'Shqiponjat e Zeza', description: 'Rrjet lagjesh që e ngatërron besnikërinë me bindjen.' },
  kapitali: { title: 'Sindikatat e Kapitalit', description: 'Konsorcium imagjinar që kërkon të kontrollojë kontratat e qytetit.' },
  rendi: { title: 'Forcat e rendit', description: 'Njësi e trilluar me zëra të ndryshëm mbi përgjegjësinë publike.' },
  underground: { title: 'Tirana Underground', description: 'Ekip garuesish arcade, mekanikësh, krijuesish dhe rivalësh me besnikëri të lëkundura.' },
} as const;
export type StoryFactionId = keyof typeof STORY_FACTIONS;
export const STORY_ENDINGS = {
  king: { title: 'The King', description: 'Turi merr drejtimin e organizatës, duke pranuar edhe çmimin e pushtetit.' },
  patriot: { title: 'The Patriot', description: 'Turi i çon provat në drejtësinë e qytetit imagjinar dhe zbulon shkeljet publikisht.' },
  ghost: { title: 'The Ghost', description: 'Turi shpëton aleatët më të afërt, ia beson arkivin një kujdestari dhe largohet nga loja e pushtetit.' },
} as const;
export type StoryEndingId = keyof typeof STORY_ENDINGS;
export type StoryMissionTag = 'arcade-action' | 'driving-pursuit' | 'dialogue' | 'exploration' | 'economy';
export type StoryReward = { readonly plotCredit: number; readonly clue?: string };
export interface StoryMissionBrief {
  readonly id: string;
  readonly title: string;
  readonly chapterId: string;
  readonly summary: string;
  readonly objectives: readonly string[];
  readonly prerequisites: readonly string[];
  readonly rewards: StoryReward;
  readonly faction: StoryFactionId;
  readonly tags: readonly StoryMissionTag[];
  readonly readiness: 'content-only';
}
export interface StoryChapter {
  readonly id: string;
  readonly title: string;
  readonly missions: readonly StoryMissionBrief[];
}
export interface StoryProgress {
  readonly completedMissionIds: readonly string[];
  readonly endingChoice?: StoryEndingId;
}

type MissionRow = readonly [slug: string, title: string, summary: string, objectiveOne: string, objectiveTwo: string, faction: StoryFactionId, clue?: string];
type ChapterRow = readonly [title: string, missions: readonly MissionRow[]];
const chapters: readonly ChapterRow[] = [
  ['Rikthimi', [
    ['return','Rikthimi në Tiranë','Turi kthehet nga Rinas, merr një mesazh të çuditshëm dhe kupton se shoku i fëmijërisë, Dreni, mungon.','Kalo dy pika kontrolli arcade me makinë drejt lagjes.','Ktheji telefonatën Drenit, pastaj lexo shënimin e tij.','underground','dreni-note'],
    ['missing-friend','Shoku që mungon','Mira tregon se Dreni nuk është parë që prej montimit të një ekspozite.','Pyet montuesit e ekspozitës çfarë mbajnë mend.','Gjej datën e fundit të konfirmuar për Drenin.','underground','last-seen'],
    ['silent-phone','Telefoni i heshtur','Një kujdestare gjen telefonin e Drenit mes sendeve të ekspozitës.','Merre telefonin nga kutia e sendeve të humbura.','Dëgjo mesazhin zanor që Dreni e la për Turin.','underground','voice-note'],
    ['archived-documents','Dokumentet e arkivuara','Mesazhi e çon Turin te një kopje e arkivit të ekspozitës.','Kërko dosjen me ndihmën e arkivistes.','Dallo faturën që nuk përputhet me regjistrin.','rendi','invoice-discrepancy'],
    ['hidden-connections','Lidhjet e fshehura','Një simbol dhe një numër dosjeje lidhin dy grupe të sajuara me të njëjtin projekt.','Krahaso shënimet me Mirën.','Ruaj një kopje të përbashkët të provave.','kapitali','linked-files'],
  ]],
  ['Ligji i lagjes', [
    ['morning-bread','Buka e mëngjesit','Një defekt i orës së tregut përmbys turnin e mëngjesit; garuesit e lagjes organizojnë xhiron e furnizimit.','Dërgo tri porosi para ziles së hapjes.','Kthehu te furra pa humbur asnjë porosi.','shqiponjat'],
    ['shared-yard','Oborri i përbashkët','Një provë familjare e biçikletave arcade e kthen oborrin në pistë.','Mbaro dy xhiro në kursin e sajuar.','Ndihmo Mirën të gjejë të riun që pa Drenin.','shqiponjat'],
    ['missing-receipt','Mandati që mungon','Në garazh, një mandat i dyfishtë bllokon riparimin e makinës së ekipit.','Riparo vetëm pjesët që lejon buxheti fiktiv.','Gjej numrin e faturës që përputhet me dosjen.','kapitali','rent-ledger'],
    ['neighbors-voice','Zëri i fqinjëve','Gjatë një nate me shkëndija elektrike, dëshmitarja vendos të largohet nga oborri.','Shoqëro dëshmitaren përmes pengesave arcade.','Jepi zgjedhjen kur dhe si ta ndajë dëshminë.','rendi'],
    ['yard-pact','Marrëveshja e oborrit','Rivalët sfidojnë Turin në një provë precizioni para se të pranojnë marrëveshjen.','Përfundo sprintin me tri porta të ndryshueshme.','Zgjidh cilit ekip i besohet garazhi i përbashkët.','shqiponjat','yard-agreement'],
  ]],
  ['Nata e Bllokut', [
    ['light-check','Prova e dritave','Dritat e klubit fiken gjatë provës së skenës dhe skena e lëvizshme ndalon në gjysmë.','Kalo pjesët e skenës kur sinjalet ritmike janë të gjelbra.','Ribashkohu me Mirën para se të mbyllet skena.','underground'],
    ['night-set','Seti i natës','Një dëshmitar ka mbetur brenda klubit, ndërsa dritat e emergjencës shuhen një nga një.','Gjej dëshmitarin sipas sinjaleve stilizuese të skenës.','Shoqëroje te ekipi i eventit para se të mbarojë ora arcade.','underground','night-set-audio'],
    ['two-posters','Dy afishe','Dy afishe zhbllokojnë dy versione të sajuara të ndriçimit të klubit.','Gjej tri shenja vizuale që nuk përputhen.','Pyet organizatoren cili version erdhi nga konsorciumi.','kapitali'],
    ['rain-plan','Plani i shiut','Rrebeshi pret skenën nga blloku i eventit dhe grupi zhvendos pajisjet.','Lëviz skenografinë në një kurs me shenja arcade.','Mbërrij te vendi rezervë pa humbur paketën e eventit.','rendi'],
    ['closing-hour','Ora e mbylljes','Një rival del nga klubi me kutinë e gabuar të pajisjeve; brenda është lista e sponsorëve.','Përfundo ndjekjen me kohë në qarkun imagjinar.','Rikupero kutinë në skenën e dorëzimit.','underground','event-sponsor-list'],
  ]],
  ['Lufta e territorit', [
    ['paper-lines','Vijat në letër','Dy ekipe kërkojnë të njëjtën punishte dhe vendosin të nxjerrin përballë makinat e tyre të provës.','Përfundo një provë drejtimi me dy lloje sipërfaqesh.','Gjej dokumentin e dyfishtë që del në fund.','kapitali'],
    ['open-door','Dyer të hapura','Një portë e prishur lë skenën pa hyrjen e premtuar dhe grupi ndryshon rrjedhën e eventit.','Zgjidh itinerarin arcade me kohën më të mirë.','Kthehu me dy personazhet që kishin mbetur pas.','shqiponjat'],
    ['third-option','Mundësia e tretë','Një regjisore ofron punishten si bazë nëse ekipi e kthen në vend me përdorim të përbashkët.','Zgjidh një përmirësim imagjinar brenda buxhetit të tregimit.','Hap provën e parë të garazhit pa blerje reale.','underground'],
    ['public-record','Regjistri publik','Arkivi imagjinar mbyllet në fund të turnit; Turi ka vetëm një dritare loje për të sqaruar dosjen.','Gjej dy kopjet e datuara para ziles.','Dorëzo dosjen për shqyrtim dhe dëgjo përgjigjen.','rendi','double-lease'],
    ['neutral-room','Tryeza neutrale','Një takim i tensionuar ndërpritet nga rryma dhe palët mbeten pa versionin përfundimtar.','Mblidh palët sërish me zgjedhje dialogu.','Siguro kopjen e marrëveshjes para mbylljes së bibliotekës.','shqiponjat','workshop-truce'],
  ]],
  ['Në kërkim', [
    ['wrong-photo','Fotografia e gabuar','Tre fotografi dërgojnë Turin në skena të ndryshme dhe vetëm njëra ka kohën e duhur.','Gjej këndin e njëjtë të fotografisë në lojë.','Elimino dy gjurmët e rreme nga harta e tregimit.','underground'],
    ['return-ticket','Bileta e kthimit','Një xhiro arcade me kohë lidh tre sportele imagjinare përpara nisjes së provës.','Kalo portat e ndryshueshme me makinën e ekipit.','Gjej biletën me datën e konfirmuar.','rendi','return-ticket'],
    ['empty-studio','Studioja bosh','Studioja e Drenit aktivizon tri skena të shkurtra nga kujtesa.','Rendit skicat sipas ngjyrave të përdorura në ekspozitë.','Gjej zërin që mungon në skenën e fundit.','underground'],
    ['voice-again','Një zë tjetër','Dreni telefonon, por rrëfimi ndërpritet teksa një defekt ndalon ashensorin e ekspozitës.','Arrij në zonën e takimit me kursin e parkimit arcade.','Konfirmo identitetin me kujtimin e përbashkët.','underground','dreni-confirmed'],
    ['ardi-terms','Kushtet e Drenit','Dreni del nga hija vetëm nëse Turi respekton kufijtë e tij; një vendim e ndryshon skenën e takimit.','Zgjidh midis dialogut të qetë dhe largimit të përbashkët.','Dakordëso cilat pjesë të dosjes mund të publikohen.','shqiponjat','dreni-consent'],
  ]],
  ['Konvoji', [
    ['relief-manifest','Lista e ndihmave','Përmbytja fiktive mbyll skenën kryesore dhe depoja komunale duhet zbrazur para ngritjes së ujit në lojë.','Etiketo pakot e nevojshme në minilojën e magazinës.','Ndihmo ekipin të marrë ngarkesën në pikën e provës.','shqiponjat'],
    ['rolling-workshop','Punishtja lëvizëse','Punishtja lëvizëse përcillet në një kurs imagjinar ku urat e skenës ngrihen me ritëm.','Shoqëro furnizimet përgjatë portave arcade.','Kalo pengesat pa mbetur prapa karvanit civil.','rendi'],
    ['missing-crate','Arka e padërguar','Një arkë largohet në një pellg të fryrë të skenës dhe skuadra e vullnetarëve kërkon ndihmë.','Rikupero arkën në një garë me orientim arcade.','Dorëzo materialin në majën e shtegut imagjinar.','underground'],
    ['receipt-trail','Gjurmët e faturave','Dy porosi për të njëjtat materiale zbulojnë një kontratë të një rrethi fiktiv.','Përball dokumentet e inventarit me variantin e kontratës.','Vendos nëse raporti ndahet tani ose pas shpëtimit.','kapitali','procurement-evidence'],
    ['open-distribution','Shpërndarja e hapur','Një familje mbetet në një platformë mes përmbytjes së sajuar dhe del një mundësi shpëtimi ajror.','Ndiq portat e fluturimit arcade mbi skenën fiktive.','Ndihmo familjen të arrijë në strehën e tregimit.','shqiponjat'],
  ]],
  ['Pas hekurave', [
    ['visitor-hours','Orari i vizitave','Turi udhëton drejt një qendre të trilluar vizitash; një ndërprerje e orarit e kthen ardhjen në provë me kohë.','Arrij te dritarja e vizitës në një kurs të mbyllur arcade.','Bind ish-punonjësin të flasë pa zbuluar familjen.','rendi'],
    ['sealed-letter','Letra e vulosur','Letra del nga qendra vetëm me lejen e autorit dhe te porta personazhet debatojnë kë duhet ta marrë.','Zgjidh kujt t’ia besosh letrën pa hapur pjesën private.','Dorëzoje te familja dhe ruaj vetëm provën e lejuar.','shqiponjat'],
    ['timeline','Vija kohore','Dëshmitë rivihen në skenë si tri sekuenca interaktive, njëra prej tyre e prerë.','Rikrijo rendin e tri skenave nga kujtesa.','Gjej momentin që lidh firmën me dosjen.','underground'],
    ['hearing-request','Kërkesa për dëgjesë','Dëgjesa lëvizet dhe kopjet duhet të mbërrijnë para se të fillojë seanca e sajuar.','Dërgo dosjen në garën arcade të dorëzimit.','Mblidh lejet për pjesët e përbashkëta.','rendi'],
    ['transcript','Procesverbali','Në dëgjesë, versioni i Mirës përplaset me dokumentin kryesor.','Zgjidh dy pyetjet që verifikojnë kundërshtinë.','Merr procesverbalin e miratuar për dosjen finale.','rendi','verified-transcript'],
  ]],
  ['Operacioni Dajti', [
    ['trail-notice','Njoftimi i shtegut','Një grup vizitorësh humb orarin e ekskursionit mbi një shteg përrallor të Dajtit.','Ndiq sinjalet arcade të shtegut.','Udhëhiq vizitorët deri në strehën e trilluar.','underground'],
    ['weather-station','Stacioni i motit','Prishja e motit në lojë ndalon udhëtimin, dhe stacioni sinjalizon ndryshim të itinerarit të skenës.','Arrij te sensorët e dallueshëm në skenën arcade.','Aktivizo animacionin e paralajmërimit.','rendi'],
    ['wind-archive','Arkivi i erës','Erërat e skenës shpërndajnë faqet e një katalogu që mund të zbulojë historinë e projektit.','Rikupero faqet e lëvizshme nga tri pika në kurs.','Radhiti për të zbuluar pronësinë e katalogut.','underground'],
    ['heritage-map','Harta e kujtesës','Një kabinë imagjinare ngec gjatë shfaqjes panoramike.','Përfundo provën me porta ajrore të sajuara.','Kthe dy alpinistët në pikën e takimit të ekipit.','shqiponjat'],
    ['summit-exhibit','Ekspozita në majë','Në kulmin e stuhisë imagjinare, ekspozita nxjerr copën e fundit të indeksit të Dajtit.','Përfundo dy faza: rikuperimin e indeksit dhe kthimin në strehë.','Lidh katalogun me projektin e lagjeve.','kapitali','dajti-index'],
  ]],
  ['Tradhtia', [
    ['changed-page','Faqja e ndërruar','Një faqe e zëvendësuar të çon pas një makine që largohet nga ekspozita në kursin e lojës.','Përfundo ndjekjen arcade para se të mbarojë ora.','Rikupero kopjen në skenën e mbërritjes.','kapitali'],
    ['miras-note','Shënimi i Mirës','Mira zbulon se rivali që i shpëtoi ekipit falsifikoi firmën e saj.','Përball rivalin me zgjedhje dialogu.','Zgjidh nëse Mira e tregon vetë tradhtinë.','underground'],
    ['voice-and-paper','Zëri dhe letra','Rrëfimi paralel ndërthur versionin e Drenit dhe imazhet e skenës ku u bë ndërrimi.','Ndërro mes dy perspektivave të sekuencës.','Gjej simbolin që zbulon identitetin e tradhtarit të trilluar.','rendi'],
    ['old-promise','Premtimi i vjetër','Rivalët shpërndahen dhe Turi duhet të marrë Drenin nga një strehë imagjinare.','Bëj sprintin me pengesa deri te pika e takimit.','Shoqëro Drenin duke ruajtur arkivin e përbashkët.','shqiponjat'],
    ['three-paths','Tri rrugë','Pas një arratisjeje arcade, ekipi ndahet mes tri vizioneve për qytetin.','Arrij pikën e takimit në qarkun përfundimtar.','Diskuto me ekipin çfarë sakrifikon në secilën rrugë.','underground','ending-options'],
  ]],
  ['Mbreti i Tiranës', [
    ['shared-evidence','Provat e përbashkëta','Në hapjen e finales, dosja shpërndahet në tri komplete gjatë zhvendosjes së studios.','Rikupero tri pjesët në fazën e parë arcade.','Ringri dosjen duke respektuar pëlqimet.','rendi'],
    ['public-square','Sheshi publik','Ndërsa skena kryesore fiket, aleatët duhet të arrijnë në sheshin imagjinar me kopjet.','Shoqëro personazhet nëpër një kurs me tri pengesa të stilizuara.','Vendos kush i prezanton provat.','shqiponjat'],
    ['last-offer','Oferta e fundit','Udhëheqësi i trilluar i konsorciumit ofron kontrollin e organizatës në skenën e dytë.','Dëgjo çmimin e ofertës dhe pasojat për aleatët.','Përgatit alternativën e drejtësisë ose të largimit.','kapitali'],
    ['keepers','Kujdestarët','Aleatët e afërt janë ende në fund të kursit, ndërsa arkivi bllokon largimin.','Përfundo fazën e shpëtimit në një itinerar imagjinar arcade.','Zgjidh një ekip të pavarur për ruajtjen e kopjeve.','underground'],
    ['final-choice','Zgjedhja e fundit','Finalja me tri akte lidh rikuperimin, mbrojtjen e aleatëve dhe vendimin që ndan historinë.','Konfirmo The King, The Patriot ose The Ghost.','Shiko epilogun përkatës: pushtet, drejtësi ose shpëtim e largim.','underground','campaign-resolution'],
  ]],
];

const A = 'arcade-action', D = 'driving-pursuit', T = 'dialogue', X = 'exploration', E = 'economy';
const chapterTags: readonly (readonly (readonly StoryMissionTag[])[])[] = [
  [[D,T], [T,X], [X,T], [X,T], [X,T]],
  [[D,A], [A,D], [E,X], [A,T], [D,A,T]],
  [[A,X], [A,X], [X,T], [A,D], [D,A]],
  [[D,X], [D,A], [E,T], [X,A], [T,X]],
  [[X], [D,A], [X], [D,T], [T]],
  [[A,X], [D,A], [A,D], [E,T], [A]],
  [[D,T], [T], [X], [D,A], [T]],
  [[A,X], [A,X], [A,X], [A], [A,X]],
  [[D,A], [T], [X,T], [A], [D,T]],
  [[A,X], [D,A], [E,T], [A,T], [A,T]],
];

let previous: string | undefined;
export const STORY_CAMPAIGN: readonly StoryChapter[] = chapters.map(([title, rows], chapterIndex) => {
  const id = `ch${String(chapterIndex + 1).padStart(2, '0')}`;
  const missions = rows.map(([slug, title, summary, objectiveOne, objectiveTwo, faction, clue], missionIndex): StoryMissionBrief => {
    const missionId = `${id}-${slug}`;
    const prerequisites = previous ? [previous] : [];
    previous = missionId;
    return {
      id: missionId, chapterId: id, title, summary, objectives: [objectiveOne, objectiveTwo], prerequisites, faction, tags: chapterTags[chapterIndex][missionIndex],
      rewards: { plotCredit: (chapterIndex + 1) * (missionIndex + 1) * 10, ...(clue ? { clue } : {}) },
      readiness: 'content-only',
    };
  });
  return { id, title, missions };
});

const storyMissions = STORY_CAMPAIGN.flatMap(({ missions }) => missions);
const storyMissionById = new Map(storyMissions.map((mission) => [mission.id, mission] as const));
export const STORY_FINALE_ID = 'ch10-final-choice';
export const getStoryMission = (id: string): StoryMissionBrief | undefined => storyMissionById.get(id);
export type StoryAvailability = 'missing' | 'locked' | 'available' | 'completed';

function hasCompletedMission(id: string, completed: ReadonlySet<string>): boolean {
  const mission = getStoryMission(id);
  return Boolean(mission && completed.has(id)
    && mission.prerequisites.every((prerequisite) => hasCompletedMission(prerequisite, completed)));
}

export function getStoryMissionAvailability(id: string, progress: StoryProgress): StoryAvailability {
  const mission = getStoryMission(id);
  if (!mission) return 'missing';
  const completed = new Set(progress.completedMissionIds);
  if (!mission.prerequisites.every((required) => hasCompletedMission(required, completed))) return 'locked';
  return completed.has(id) ? 'completed' : 'available';
}

export function getStoryEnding(progress: StoryProgress): StoryEndingId | undefined {
  const choice = progress.endingChoice;
  return choice && Object.hasOwn(STORY_ENDINGS, choice)
    && getStoryMissionAvailability(STORY_FINALE_ID, progress) === 'completed' ? choice : undefined;
}

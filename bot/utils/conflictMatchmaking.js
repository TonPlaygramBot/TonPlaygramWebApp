import geoip from 'geoip-lite';

const CONFLICT_MAP = {
  "\uD83C\uDDE6\uD83C\uDDF1": {
    region: "Balkans",
    rivals: ["\uD83C\uDDF7\uD83C\uDDF8", "\uD83C\uDDEC\uD83C\uDDF7", "\uD83C\uDDF2\uD83C\uDDF0"],
    reason: "Ethnic tensions, historical disputes, minority rights, recognition of Kosovo"
  },
  "\uD83C\uDDF7\uD83C\uDDF8": {
    region: "Balkans",
    rivals: ["\uD83C\uDDE6\uD83C\uDDF1", "\uD83C\uDDFD\uD83C\uDDF0", "\uD83C\uDDED\uD83C\uDDF7", "\uD83C\uDDE7\uD83C\uDDE6"],
    reason: "Post-Yugoslav wars, Kosovo, nationalism, ethnic conflicts"
  },
  "\uD83C\uDDFD\uD83C\uDDF0": {
    region: "Balkans",
    rivals: ["\uD83C\uDDF7\uD83C\uDDF8"],
    reason: "Unrecognized independence by Serbia, historical control"
  },
  "\uD83C\uDDE8\uD83C\uDDF1": {
    region: "Middle East",
    rivals: ["\uD83C\uDDEE\uD83C\uDDF7", "\uD83C\uDDF5\uD83C\uDDF8", "\uD83C\uDDF8\uD83C\uDDFE", "\uD83C\uDDF1\uD83C\uDDE7"],
    reason: "Territorial occupation, religious conflict, Iran-Israel enmity"
  },
  "\uD83C\uDDF5\uD83C\uDDF8": {
    region: "Middle East",
    rivals: ["\uD83C\uDDE8\uD83C\uDDF1"],
    reason: "Occupation of West Bank & Gaza, calls for statehood"
  },
  "\uD83C\uDDEE\uD83C\uDDF7": {
    region: "Middle East",
    rivals: ["\uD83C\uDDE8\uD83C\uDDF1", "\uD83C\uDDF8\uD83C\uDDE6", "\uD83C\uDDFA\uD83C\uDDF8"],
    reason: "Nuclear program, proxy wars, sectarian divide"
  },
  "\uD83C\uDDF8\uD83C\uDDE6": {
    region: "Middle East",
    rivals: ["\uD83C\uDDEE\uD83C\uDDF7", "\uD83C\uDDFE\uD83C\uDDEA", "\uD83C\uDDF6\uD83C\uDDEA"],
    reason: "Regional dominance, Sunni-Shia divide, Yemen war"
  },
  "\uD83C\uDDF9\uD83C\uDDF7": {
    region: "Europe/Middle East",
    rivals: ["\uD83C\uDDEC\uD83C\uDDF7", "\uD83C\uDDE6\uD83C\uDDF2", "\uD83C\uDDE8\uD83C\uDDFE"],
    reason: "Aegean Sea disputes, Cyprus division, Armenian genocide denial"
  },
  "\uD83C\uDDEE\uD83C\uDDF3": {
    region: "South Asia",
    rivals: ["\uD83C\uDDF5\uD83C\uDDF0", "\uD83C\uDDE8\uD83C\uDDF3"],
    reason: "Kashmir conflict, border skirmishes, political tension"
  },
  "\uD83C\uDDF5\uD83C\uDDF0": {
    region: "South Asia",
    rivals: ["\uD83C\uDDEE\uD83C\uDDF3"],
    reason: "Territorial claims in Kashmir, terrorism accusations"
  },
  "\uD83C\uDDE8\uD83C\uDDF3": {
    region: "East Asia",
    rivals: ["\uD83C\uDDF9\uD83C\uDDFC", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEE\uD83C\uDDF3", "\uD83C\uDDEF\uD83C\uDDF5", "\uD83C\uDDF5\uD83C\uDDED"],
    reason: "South China Sea, Taiwan sovereignty, border tension"
  },
  "\uD83C\uDDF9\uD83C\uDDFC": {
    region: "East Asia",
    rivals: ["\uD83C\uDDE8\uD83C\uDDF3"],
    reason: "China claims Taiwan as its province; Taiwan claims independence"
  },
  "\uD83C\uDDF7\uD83C\uDDFA": {
    region: "Eurasia",
    rivals: ["\uD83C\uDDFA\uD83C\uDDE6", "\uD83C\uDDF5\uD83C\uDDF1", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEC\uD83C\uDDE7", "\uD83C\uDDF1\uD83C\uDDF9"],
    reason: "Ukraine war, NATO expansion, post-Soviet influence"
  },
  "\uD83C\uDDFA\uD83C\uDDE6": {
    region: "Eurasia",
    rivals: ["\uD83C\uDDF7\uD83C\uDDFA"],
    reason: "Russia's annexation of Crimea and invasion in 2022"
  },
  "\uD83C\uDDFA\uD83C\uDDF8": {
    region: "Global",
    rivals: ["\uD83C\uDDE8\uD83C\uDDF3", "\uD83C\uDDF7\uD83C\uDDFA", "\uD83C\uDDEE\uD83C\uDDF7", "\uD83C\uDDFB\uD83C\uDDEA", "\uD83C\uDDF0\uD83C\uDDF5", "\uD83C\uDDFA\uD83C\uDDFA"],
    reason: "Cold War legacy, nuclear threats, ideological opposition"
  },
  "\uD83C\uDDFB\uD83C\uDDEA": {
    region: "Americas",
    rivals: ["\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDE8\uD83C\uDDF4"],
    reason: "US sanctions, regime change attempts, border clashes"
  },
  "\uD83C\uDDE8\uD83C\uDDF4": {
    region: "Caribbean",
    rivals: ["\uD83C\uDDFA\uD83C\uDDF8"],
    reason: "Embargoes, Cold War history, failed diplomacy"
  },
  "\uD83C\uDDF0\uD83C\uDDF5": {
    region: "East Asia",
    rivals: ["\uD83C\uDDF0\uD83C\uDDF7", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEF\uD83C\uDDF5"],
    reason: "Nuclear program, Korean War legacy"
  },
  "\uD83C\uDDEC\uD83C\uDDF7": {
    region: "Europe",
    rivals: ["\uD83C\uDDF9\uD83C\uDDF7", "\uD83C\uDDE6\uD83C\uDDF1"],
    reason: "Aegean disputes, maritime borders, minority rights"
  },
  "\uD83C\uDDEC\uD83C\uDDE7": {
    region: "Caucasus",
    rivals: ["\uD83C\uDDF7\uD83C\uDDFA"],
    reason: "Russian support for separatists in Abkhazia and South Ossetia"
  },
  "\uD83C\uDDE6\uD83C\uDDF2": {
    region: "Caucasus",
    rivals: ["\uD83C\uDDE7\uD83C\uDDFF", "\uD83C\uDDF9\uD83C\uDDF7"],
    reason: "Nagorno-Karabakh conflict, genocide recognition"
  },
  "\uD83C\uDDE7\uD83C\uDDFF": {
    region: "Caucasus",
    rivals: ["\uD83C\uDDE6\uD83C\uDDF2"],
    reason: "Ongoing conflict over Nagorno-Karabakh region"
  }
};

function codeToFlag(code) {
  if (!code || code.length !== 2) return '🏳️';
  const codePoints = [...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

function ipToFlag(ip) {
  const geo = geoip.lookup(ip);
  const code = geo && geo.country ? geo.country : 'US';
  return codeToFlag(code);
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function get2PlayerConflict(ip) {
  const flag = ipToFlag(ip);
  const rivals = CONFLICT_MAP[flag]?.rivals;
  const rival = rivals && rivals.length ? randomItem(rivals) : randomItem(Object.keys(CONFLICT_MAP));
  return [flag, rival];
}

export function get3PlayerConflict(ip) {
  const flag = ipToFlag(ip);
  const rivals = CONFLICT_MAP[flag]?.rivals || [];
  if (rivals.length >= 2) {
    const first = randomItem(rivals);
    const secondCandidates = rivals.filter(r => r !== first && (CONFLICT_MAP[first]?.rivals || []).includes(r));
    if (secondCandidates.length) {
      const second = randomItem(secondCandidates);
      return [flag, first, second];
    }
  }
  const allFlags = Object.keys(CONFLICT_MAP).filter(f => f !== flag);
  while (allFlags.length < 2) allFlags.push(flag);
  const choice1 = randomItem(allFlags);
  let choice2 = randomItem(allFlags);
  while (choice2 === choice1) choice2 = randomItem(allFlags);
  return [flag, choice1, choice2];
}

const REGION_GROUPS = {};
for (const [flag, info] of Object.entries(CONFLICT_MAP)) {
  if (!REGION_GROUPS[info.region]) REGION_GROUPS[info.region] = [];
  REGION_GROUPS[info.region].push(flag);
}

export function get4PlayerConflict(region = null) {
  const groups = region && REGION_GROUPS[region] ? [region] : Object.keys(REGION_GROUPS);
  const chosenRegion = randomItem(groups);
  const flags = REGION_GROUPS[chosenRegion];
  const set = new Set();
  while (set.size < Math.min(4, flags.length)) {
    set.add(randomItem(flags));
  }
  return Array.from(set);
}

export { CONFLICT_MAP };

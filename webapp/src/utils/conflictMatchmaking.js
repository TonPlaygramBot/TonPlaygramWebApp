// Browser-friendly conflict matchmaking utilities
// Derived from bot/utils/conflictMatchmaking.js

export const CONFLICT_MAP = {
  '\ud83c\udde6\ud83c\uddf1': {
    region: 'Balkans',
    rivals: ['\ud83c\uddf7\ud83c\uddf8', '\ud83c\uddec\ud83c\uddf7', '\ud83c\uddf2\ud83c\uddf0'],
    reason: 'Ethnic tensions, historical disputes, minority rights, recognition of Kosovo'
  },
  '\ud83c\uddf7\ud83c\uddf8': {
    region: 'Balkans',
    rivals: ['\ud83c\udde6\ud83c\uddf1', '\ud83c\uddfd\ud83c\uddf0', '\ud83c\udded\ud83c\uddf7', '\ud83c\udde7\ud83c\udde6'],
    reason: 'Post-Yugoslav wars, Kosovo, nationalism, ethnic conflicts'
  },
  '\ud83c\uddfd\ud83c\uddf0': {
    region: 'Balkans',
    rivals: ['\ud83c\uddf7\ud83c\uddf8'],
    reason: 'Unrecognized independence by Serbia, historical control'
  },
  '\ud83c\udde8\ud83c\uddf1': {
    region: 'Middle East',
    rivals: ['\ud83c\uddee\ud83c\uddf7', '\ud83c\uddf5\ud83c\uddf8', '\ud83c\uddf8\ud83c\uddfe', '\ud83c\uddf1\ud83c\udde7'],
    reason: 'Territorial occupation, religious conflict, Iran-Israel enmity'
  },
  '\ud83c\uddf5\ud83c\uddf8': {
    region: 'Middle East',
    rivals: ['\ud83c\udde8\ud83c\uddf1'],
    reason: 'Occupation of West Bank & Gaza, calls for statehood'
  },
  '\ud83c\uddee\ud83c\uddf7': {
    region: 'Middle East',
    rivals: ['\ud83c\udde8\ud83c\uddf1', '\ud83c\uddf8\ud83c\udde6', '\ud83c\uddfa\ud83c\uddf8'],
    reason: 'Nuclear program, proxy wars, sectarian divide'
  },
  '\ud83c\uddf8\ud83c\udde6': {
    region: 'Middle East',
    rivals: ['\ud83c\uddee\ud83c\uddf7', '\ud83c\uddfe\ud83c\uddea', '\ud83c\uddf6\ud83c\uddea'],
    reason: 'Regional dominance, Sunni-Shia divide, Yemen war'
  },
  '\ud83c\uddf9\ud83c\uddf7': {
    region: 'Europe/Middle East',
    rivals: ['\ud83c\uddec\ud83c\uddf7', '\ud83c\udde6\ud83c\uddf2', '\ud83c\udde8\ud83c\uddfe'],
    reason: 'Aegean Sea disputes, Cyprus division, Armenian genocide denial'
  },
  '\ud83c\uddee\ud83c\uddf3': {
    region: 'South Asia',
    rivals: ['\ud83c\uddf5\ud83c\uddf0', '\ud83c\udde8\ud83c\uddf3'],
    reason: 'Kashmir conflict, border skirmishes, political tension'
  },
  '\ud83c\uddf5\ud83c\uddf0': {
    region: 'South Asia',
    rivals: ['\ud83c\uddee\ud83c\uddf3'],
    reason: 'Territorial claims in Kashmir, terrorism accusations'
  },
  '\ud83c\udde8\ud83c\uddf3': {
    region: 'East Asia',
    rivals: ['\ud83c\uddf9\ud83c\uddfc', '\ud83c\uddfa\ud83c\uddf8', '\ud83c\uddee\ud83c\uddf3', '\ud83c\uddef\ud83c\uddf5', '\ud83c\uddf5\ud83c\udded'],
    reason: 'South China Sea, Taiwan sovereignty, border tension'
  },
  '\ud83c\uddf9\ud83c\uddfc': {
    region: 'East Asia',
    rivals: ['\ud83c\udde8\ud83c\uddf3'],
    reason: 'China claims Taiwan as its province; Taiwan claims independence'
  },
  '\ud83c\uddf7\ud83c\uddfa': {
    region: 'Eurasia',
    rivals: ['\ud83c\uddfa\ud83c\udde6', '\ud83c\uddf5\ud83c\uddf1', '\ud83c\uddfa\ud83c\uddf8', '\ud83c\uddec\ud83c\udde7', '\ud83c\uddf1\ud83c\uddf9'],
    reason: 'Ukraine war, NATO expansion, post-Soviet influence'
  },
  '\ud83c\uddfa\ud83c\udde6': {
    region: 'Eurasia',
    rivals: ['\ud83c\uddf7\ud83c\uddfa'],
    reason: "Russia's annexation of Crimea and invasion in 2022"
  },
  '\ud83c\uddfa\ud83c\uddf8': {
    region: 'Global',
    rivals: ['\ud83c\udde8\ud83c\uddf3', '\ud83c\uddf7\ud83c\uddfa', '\ud83c\uddee\ud83c\uddf7', '\ud83c\uddfb\ud83c\uddea', '\ud83c\uddf0\ud83c\uddf5', '\ud83c\uddfa\ud83c\uddfa'],
    reason: 'Cold War legacy, nuclear threats, ideological opposition'
  },
  '\ud83c\uddfb\ud83c\uddea': {
    region: 'Americas',
    rivals: ['\ud83c\uddfa\ud83c\uddf8', '\ud83c\udde8\ud83c\uddf4'],
    reason: 'US sanctions, regime change attempts, border clashes'
  },
  '\ud83c\udde8\ud83c\uddf4': {
    region: 'Caribbean',
    rivals: ['\ud83c\uddfa\ud83c\uddf8'],
    reason: 'Embargoes, Cold War history, failed diplomacy'
  },
  '\ud83c\uddf0\ud83c\uddf5': {
    region: 'East Asia',
    rivals: ['\ud83c\uddf0\ud83c\uddf7', '\ud83c\uddfa\ud83c\uddf8', '\ud83c\uddef\ud83c\uddf5'],
    reason: 'Nuclear program, Korean War legacy'
  },
  '\ud83c\uddec\ud83c\uddf7': {
    region: 'Europe',
    rivals: ['\ud83c\uddf9\ud83c\uddf7', '\ud83c\udde6\ud83c\uddf1'],
    reason: 'Aegean disputes, maritime borders, minority rights'
  },
  '\ud83c\uddec\ud83c\udde7': {
    region: 'Caucasus',
    rivals: ['\ud83c\uddf7\ud83c\uddfa'],
    reason: 'Russian support for separatists in Abkhazia and South Ossetia'
  },
  '\ud83c\udde6\ud83c\uddf2': {
    region: 'Caucasus',
    rivals: ['\ud83c\udde7\ud83c\udfff', '\ud83c\uddf9\ud83c\uddf7'],
    reason: 'Nagorno-Karabakh conflict, genocide recognition'
  },
  '\ud83c\udde7\ud83c\udfff': {
    region: 'Caucasus',
    rivals: ['\ud83c\udde6\ud83c\uddf2'],
    reason: 'Ongoing conflict over Nagorno-Karabakh region'
  }
};

function codeToFlag(code) {
  if (!code || code.length !== 2) return '🏳️';
  const points = [...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

export async function ipToFlag() {
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem('ipFlag');
    if (cached) return cached;
  }
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    const flag = codeToFlag(data && data.country ? data.country : 'US');
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('ipFlag', flag);
      } catch {}
    }
    return flag;
  } catch {
    return '🇺🇸';
  }
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const REGION_GROUPS = {};
for (const [flag, info] of Object.entries(CONFLICT_MAP)) {
  if (!REGION_GROUPS[info.region]) REGION_GROUPS[info.region] = [];
  REGION_GROUPS[info.region].push(flag);
}

export const REGIONS = Object.keys(REGION_GROUPS);

export async function get2PlayerConflict(region = null) {
  const flag = region && REGION_GROUPS[region]
    ? randomItem(REGION_GROUPS[region])
    : await ipToFlag();
  const rivals = CONFLICT_MAP[flag]?.rivals || [];
  const filtered = region
    ? rivals.filter(r => REGION_GROUPS[region].includes(r))
    : rivals;
  const rival = filtered.length
    ? randomItem(filtered)
    : randomItem(Object.keys(CONFLICT_MAP));
  return [flag, rival];
}

export async function get3PlayerConflict(region = null) {
  const flag = region && REGION_GROUPS[region]
    ? randomItem(REGION_GROUPS[region])
    : await ipToFlag();
  const rivals = CONFLICT_MAP[flag]?.rivals || [];
  const usable = region
    ? rivals.filter(r => REGION_GROUPS[region].includes(r))
    : rivals;
  if (usable.length >= 2) {
    const first = randomItem(usable);
    const secondCandidates = usable.filter(
      r => r !== first && (CONFLICT_MAP[first]?.rivals || []).includes(r)
    );
    if (secondCandidates.length) {
      const second = randomItem(secondCandidates);
      return [flag, first, second];
    }
  }
  const allFlags = (region ? REGION_GROUPS[region] : Object.keys(CONFLICT_MAP)).filter(f => f !== flag);
  while (allFlags.length < 2) allFlags.push(flag);
  const choice1 = randomItem(allFlags);
  let choice2 = randomItem(allFlags);
  while (choice2 === choice1) choice2 = randomItem(allFlags);
  return [flag, choice1, choice2];
}

export function get4PlayerConflict(region = null) {
  const groups =
    region && REGION_GROUPS[region] ? [region] : Object.keys(REGION_GROUPS);
  const chosenRegion = randomItem(groups);
  const flags = [...REGION_GROUPS[chosenRegion]];
  // Ensure we always have at least 4 candidate flags
  const allFlags = Object.keys(CONFLICT_MAP);
  while (flags.length < 4) {
    const next = randomItem(allFlags);
    if (!flags.includes(next)) flags.push(next);
  }
  const set = new Set();
  while (set.size < 4) {
    set.add(randomItem(flags));
  }
  return Array.from(set);
}

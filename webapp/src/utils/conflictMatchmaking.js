// Browser-friendly conflict matchmaking utilities
// Derived from bot/utils/conflictMatchmaking.js

export const CONFLICT_MAP = {
  '🇦🇱': {
    region: 'Balkans',
    rivals: ['🇷🇸', '🇬🇷', '🇲🇰'],
    reason: 'Kosovo recognition, ethnic tensions, historical disputes'
  },
  '🇷🇸': {
    region: 'Balkans',
    rivals: ['🇽🇌', '🇦🇱', '🇭🇷', '🇧🇦'],
    reason: 'Post-Yugoslav wars, nationalism, ethnic conflicts'
  },
  '🇽🇌': {
    region: 'Balkans',
    rivals: ['🇷🇸'],
    reason: 'Unrecognized independence, territorial claim'
  },
  '🇺🇸': {
    region: 'Global',
    rivals: ['🇨🇳', '🇷🇺', '🇮🇷', '🇻🇪', '🇰🇵', '🇨🇺'],
    reason: 'Superpower rivalries, nuclear tension, sanctions'
  },
  '🇨🇳': {
    region: 'East Asia',
    rivals: ['🇺🇸', '🇮🇳', '🇯🇵', '🇹🇼', '🇵🇭'],
    reason: 'South China Sea, Taiwan sovereignty, regional dominance'
  },
  '🇷🇺': {
    region: 'Eurasia',
    rivals: ['🇺🇦', '🇵🇱', '🇺🇸', '🇬🇧', '🇱🇹'],
    reason: 'Ukraine invasion, NATO expansion, Cold War legacy'
  },
  '🇮🇳': {
    region: 'South Asia',
    rivals: ['🇵🇰', '🇨🇳'],
    reason: 'Kashmir, border skirmishes, regional rivalry'
  },
  '🇵🇰': {
    region: 'South Asia',
    rivals: ['🇮🇳', '🇦🇫'],
    reason: 'Kashmir conflict, terrorism accusations'
  },
  '🇹🇷': {
    region: 'Eurasia/Middle East',
    rivals: ['🇬🇷', '🇦🇲', '🇨🇾'],
    reason: 'Aegean disputes, Cyprus occupation, genocide denial'
  },
  '🇮🇱': {
    region: 'Middle East',
    rivals: ['🇵🇸', '🇮🇷', '🇸🇾', '🇱🇧'],
    reason: 'Territorial conflict, religious war, Iranian threats'
  },
  '🇵🇸': {
    region: 'Middle East',
    rivals: ['🇮🇱'],
    reason: 'Occupation, sovereignty claims'
  },
  '🇮🇷': {
    region: 'Middle East',
    rivals: ['🇺🇸', '🇮🇱', '🇸🇦'],
    reason: 'Nuclear program, ideological rivalry, proxy wars'
  },
  '🇸🇦': {
    region: 'Middle East',
    rivals: ['🇮🇷', '🇾🇪', '🇶🇦'],
    reason: 'Sunni-Shia divide, regional dominance'
  },
  '🇦🇲': {
    region: 'Caucasus',
    rivals: ['🇦🇿', '🇹🇷'],
    reason: 'Nagorno-Karabakh, historical genocide, border tension'
  },
  '🇦🇿': {
    region: 'Caucasus',
    rivals: ['🇦🇲'],
    reason: 'Territorial claim over Nagorno-Karabakh'
  },
  '🇬🇧': {
    region: 'Europe/Global',
    rivals: ['🇷🇺', '🇦🇷'],
    reason: 'Support for Ukraine, Falklands War legacy'
  },
  '🇦🇷': {
    region: 'South America',
    rivals: ['🇬🇧', '🇨🇱'],
    reason: 'Falklands, Patagonia tensions'
  },
  '🇧🇷': {
    region: 'South America',
    rivals: ['🇻🇪', '🇧🇴'],
    reason: 'Ideological differences, Amazon resource disputes'
  },
  '🇻🇪': {
    region: 'South America',
    rivals: ['🇺🇸', '🇨🇴', '🇧🇷'],
    reason: 'Sanctions, military threats, migration'
  },
  '🇰🇵': {
    region: 'East Asia',
    rivals: ['🇰🇷', '🇺🇸', '🇯🇵'],
    reason: 'Nuclear threat, war legacy, missile launches'
  },
  '🇰🇷': {
    region: 'East Asia',
    rivals: ['🇰🇵', '🇯🇵'],
    reason: 'Historical occupation, military tension'
  },
  '🇯🇵': {
    region: 'East Asia',
    rivals: ['🇨🇳', '🇰🇷', '🇷🇺'],
    reason: 'Island disputes, World War legacy'
  },
  '🇹🇼': {
    region: 'East Asia',
    rivals: ['🇨🇳'],
    reason: 'Independence claims vs Chinese sovereignty'
  },
  '🇲🇽': {
    region: 'North America',
    rivals: ['🇺🇸'],
    reason: 'Border wall, drug wars, immigration'
  },
  '🇩🇿': {
    region: 'Africa',
    rivals: ['🇲🇦', '🇫🇷'],
    reason: 'Western Sahara conflict, post-colonial tension'
  },
  '🇲🇦': {
    region: 'Africa',
    rivals: ['🇩🇿', '🇪🇸'],
    reason: 'Sahara dispute, migration, Ceuta/Melilla'
  },
  '🇪🇬': {
    region: 'Africa',
    rivals: ['🇪🇹', '🇸🇩'],
    reason: 'Nile water dispute over GERD dam'
  },
  '🇪🇹': {
    region: 'Africa',
    rivals: ['🇪🇬', '🇸🇩', '🇪🇷'],
    reason: 'Water rights, border clashes, internal conflict'
  },
  '🇳🇬': {
    region: 'Africa',
    rivals: ['🇿🇦'],
    reason: 'Economic rivalry, migration disputes'
  },
  '🇿🇦': {
    region: 'Africa',
    rivals: ['🇳🇬'],
    reason: 'Leadership competition in Africa'
  },
  '🇸🇾': {
    region: 'Middle East',
    rivals: ['🇮🇱', '🇹🇷', '🇺🇸'],
    reason: 'Civil war, proxy wars, occupation'
  },
  '🇨🇺': {
    region: 'Caribbean',
    rivals: ['🇺🇸'],
    reason: 'Embargo, ideological Cold War tension'
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

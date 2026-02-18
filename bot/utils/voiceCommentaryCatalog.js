const FALLBACK_VOICE_CATALOG = [
  { id: 'nova_en_us_f', locale: 'en-US', language: 'English', gender: 'female', style: 'energetic', provider: 'nvidia-personaplex', isDefault: true, isFree: true },
  { id: 'atlas_en_us_m', locale: 'en-US', language: 'English', gender: 'male', style: 'professional', provider: 'nvidia-personaplex', isFree: true },
  { id: 'luna_es_es_f', locale: 'es-ES', language: 'Spanish', gender: 'female', style: 'friendly', provider: 'nvidia-personaplex' },
  { id: 'orion_es_mx_m', locale: 'es-MX', language: 'Spanish', gender: 'male', style: 'energetic', provider: 'nvidia-personaplex' },
  { id: 'selene_fr_fr_f', locale: 'fr-FR', language: 'French', gender: 'female', style: 'calm', provider: 'nvidia-personaplex' },
  { id: 'leo_de_de_m', locale: 'de-DE', language: 'German', gender: 'male', style: 'professional', provider: 'nvidia-personaplex' },
  { id: 'sofia_it_it_f', locale: 'it-IT', language: 'Italian', gender: 'female', style: 'friendly', provider: 'nvidia-personaplex' },
  { id: 'sakura_ja_jp_f', locale: 'ja-JP', language: 'Japanese', gender: 'female', style: 'energetic', provider: 'nvidia-personaplex' },
  { id: 'jin_ko_kr_m', locale: 'ko-KR', language: 'Korean', gender: 'male', style: 'professional', provider: 'nvidia-personaplex' },
  { id: 'maya_hi_in_f', locale: 'hi-IN', language: 'Hindi', gender: 'female', style: 'friendly', provider: 'nvidia-personaplex' },
  { id: 'amir_ar_sa_m', locale: 'ar-SA', language: 'Arabic', gender: 'male', style: 'calm', provider: 'nvidia-personaplex' },
  { id: 'anisa_sq_al_f', locale: 'sq-AL', language: 'Albanian', gender: 'female', style: 'friendly', provider: 'nvidia-personaplex' },
  { id: 'ivo_pt_br_m', locale: 'pt-BR', language: 'Portuguese', gender: 'male', style: 'energetic', provider: 'nvidia-personaplex' },
  { id: 'olena_uk_ua_f', locale: 'uk-UA', language: 'Ukrainian', gender: 'female', style: 'calm', provider: 'nvidia-personaplex' }
];

const CATALOG_TTL_MS = 5 * 60 * 1000;
let cache = {
  voices: FALLBACK_VOICE_CATALOG,
  source: 'fallback',
  fetchedAt: 0
};

const normalizeLanguage = (voice) => {
  if (voice.language) return String(voice.language);
  if (voice.locale) {
    const [base] = String(voice.locale).split('-');
    return base.toUpperCase();
  }
  return 'Unknown';
};

const normalizeVoice = (voice, index = 0) => ({
  id: String(voice.id || voice.voice_id || voice.voice || `voice_${index}`),
  locale: String(voice.locale || voice.language_code || voice.lang || 'en-US'),
  language: normalizeLanguage(voice),
  gender: String(voice.gender || 'neutral').toLowerCase(),
  style: String(voice.style || 'professional').toLowerCase(),
  provider: 'nvidia-personaplex',
  isDefault: Boolean(voice.isDefault),
  isFree: Boolean(voice.isFree)
});

const fallbackCatalog = () => ({
  provider: 'nvidia-personaplex',
  source: 'fallback',
  voices: FALLBACK_VOICE_CATALOG,
  languages: Array.from(new Set(FALLBACK_VOICE_CATALOG.map((voice) => voice.language))).sort()
});

async function fetchProviderCatalog() {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  const path = process.env.PERSONAPLEX_VOICES_PATH || '/v1/voices';
  if (!endpoint || !apiKey) return null;

  const response = await fetch(`${endpoint.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    throw new Error(`PersonaPlex voices endpoint failed (${response.status})`);
  }

  const body = await response.json();
  const rows = Array.isArray(body?.voices) ? body.voices : Array.isArray(body) ? body : [];
  if (!rows.length) return null;

  const voices = rows.map((voice, index) => normalizeVoice(voice, index));
  return {
    provider: 'nvidia-personaplex',
    source: 'remote',
    voices,
    languages: Array.from(new Set(voices.map((voice) => voice.language))).sort()
  };
}

export async function getVoiceCatalog({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && now - cache.fetchedAt < CATALOG_TTL_MS) {
    return {
      provider: 'nvidia-personaplex',
      source: cache.source,
      voices: cache.voices,
      languages: Array.from(new Set(cache.voices.map((voice) => voice.language))).sort()
    };
  }

  try {
    const remoteCatalog = await fetchProviderCatalog();
    if (remoteCatalog?.voices?.length) {
      cache = { voices: remoteCatalog.voices, source: 'remote', fetchedAt: now };
      return remoteCatalog;
    }
  } catch (error) {
    console.warn('voice-catalog-fetch-failed', error.message);
  }

  const fallback = fallbackCatalog();
  cache = { voices: fallback.voices, source: 'fallback', fetchedAt: now };
  return fallback;
}

export const DEFAULT_FREE_VOICE_ID = 'nova_en_us_f';

export function createDefaultVoiceInventory() {
  return {
    ownedVoiceIds: [DEFAULT_FREE_VOICE_ID],
    ownedLocales: ['en-US'],
    selectedVoiceId: DEFAULT_FREE_VOICE_ID,
    updatedAt: new Date().toISOString()
  };
}

export function normalizeVoiceInventory(rawInventory) {
  const base = createDefaultVoiceInventory();
  if (!rawInventory || typeof rawInventory !== 'object') return base;

  const ownedSet = new Set([DEFAULT_FREE_VOICE_ID]);
  if (Array.isArray(rawInventory.ownedVoiceIds)) {
    rawInventory.ownedVoiceIds.forEach((voiceId) => {
      if (voiceId) ownedSet.add(String(voiceId));
    });
  }

  const ownedLocales = new Set(['en-US']);
  if (Array.isArray(rawInventory.ownedLocales)) {
    rawInventory.ownedLocales.forEach((locale) => {
      if (locale) ownedLocales.add(String(locale));
    });
  }

  const selectedVoiceId = ownedSet.has(rawInventory.selectedVoiceId)
    ? rawInventory.selectedVoiceId
    : DEFAULT_FREE_VOICE_ID;

  return {
    ownedVoiceIds: Array.from(ownedSet),
    ownedLocales: Array.from(ownedLocales),
    selectedVoiceId,
    updatedAt: rawInventory.updatedAt || base.updatedAt
  };
}

export function buildVoiceStoreItems(catalog) {
  const languageMap = new Map();
  for (const voice of catalog.voices) {
    const key = `${voice.language}|${voice.locale.split('-')[0]}`;
    if (!languageMap.has(key)) {
      languageMap.set(key, {
        id: `voice-${voice.locale.toLowerCase()}`,
        type: 'voiceLanguage',
        optionId: voice.locale,
        name: `${voice.language} Commentary Pack`,
        description: `${voice.language} commentary voices for all games`,
        price: voice.locale.toLowerCase().startsWith('en-') ? 0 : 2200,
        voiceIds: []
      });
    }
    languageMap.get(key).voiceIds.push(voice.id);
  }

  return Array.from(languageMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

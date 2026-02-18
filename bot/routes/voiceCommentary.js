import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import {
  DEFAULT_FREE_VOICE_ID,
  buildVoiceStoreItems,
  createDefaultVoiceInventory,
  getVoiceCatalog,
  normalizeVoiceInventory
} from '../utils/voiceCommentaryCatalog.js';

const router = Router();

const HELP_RESPONSES = [
  {
    keywords: ['wallet', 'send', 'receive', 'deposit', 'withdraw'],
    answer:
      'To use wallet, open Wallet, then choose send or receive. Keep enough T P C balance before paid matches and confirm your linked account.'
  },
  {
    keywords: ['store', 'buy', 'purchase', 'voice', 'commentary'],
    answer:
      'Open Store, choose your item, then confirm purchase. Voice language packs unlock commentary across all games after payment.'
  },
  {
    keywords: ['game', 'play', 'match', 'start'],
    answer:
      'Open Games, select a game mode, then join a lobby or start a match. For paid games, make sure your T P C balance is ready.'
  },
  {
    keywords: ['account', 'telegram', 'google', 'connect'],
    answer:
      'From Home, connect Telegram, Google, or wallet. Linking your account helps sync inventory and protects your progress.'
  }
];

export function buildHelpAnswer(question = '') {
  const normalized = String(question || '').toLowerCase();
  if (!normalized) {
    return 'Hello, I am TonPlaygram voice help. How can I help you today?';
  }
  const match = HELP_RESPONSES.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  if (match) return match.answer;
  return 'I can help with wallet, games, store purchases, voice commentary, and account setup. Please ask one of these topics.';
}

async function loadUser(accountId) {
  if (!accountId) return null;
  return User.findOne({ accountId });
}

function resolveSelectedVoice({ catalogVoices = [], inventory, overrideVoiceId, overrideLocale }) {
  const voices = Array.isArray(catalogVoices) ? catalogVoices : [];
  if (!voices.length) return null;

  if (overrideVoiceId) {
    const byId = voices.find((voice) => String(voice.id) === String(overrideVoiceId));
    if (byId) return byId;
  }

  const normalizedInventory = normalizeVoiceInventory(inventory);

  const selectedOwned = voices.find((voice) =>
    normalizedInventory.ownedVoiceIds.includes(String(voice.id)) &&
    String(voice.id) === String(normalizedInventory.selectedVoiceId)
  );
  if (selectedOwned) return selectedOwned;

  if (overrideLocale) {
    const byLocale = voices.find((voice) => String(voice.locale).toLowerCase() === String(overrideLocale).toLowerCase());
    if (byLocale) return byLocale;
  }

  const firstOwned = voices.find((voice) => normalizedInventory.ownedVoiceIds.includes(String(voice.id)));
  if (firstOwned) return firstOwned;

  return voices.find((voice) => String(voice.id) === DEFAULT_FREE_VOICE_ID) || voices[0];
}

async function synthesizeWithPersonaplex({ text, voiceId, locale, metadata = {} }) {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  const synthPath = process.env.PERSONAPLEX_SYNTHESIS_PATH || '/v1/speech/synthesize';
  if (!endpoint) {
    throw new Error('PersonaPlex is not configured. Set PERSONAPLEX_API_URL.');
  }

  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const candidates = [
    {
      input: text,
      voice: voiceId,
      locale,
      metadata
    },
    {
      text,
      voice_id: voiceId,
      language: locale,
      metadata
    },
    {
      input: {
        text
      },
      voice: {
        id: voiceId,
        locale
      },
      metadata
    }
  ];

  let response = null;
  let details = '';
  for (const body of candidates) {
    response = await fetch(`${endpoint.replace(/\/$/, '')}${synthPath.startsWith('/') ? synthPath : `/${synthPath}`}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.ok) break;
    details = await response.text();
    if (![400, 404, 422].includes(response.status)) {
      break;
    }
  }

  if (!response?.ok) {
    throw new Error(`PersonaPlex synthesis failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const synthesis = normalizeSynthesisPayload(payload);
  return {
    provider: 'nvidia-personaplex',
    ...synthesis,
    raw: payload
  };
}

const AUDIO_URL_KEYS = ['audioUrl', 'audio_url', 'url', 'audio_url_signed', 'signed_url'];
const AUDIO_BASE64_KEYS = ['audioBase64', 'audio_base64', 'audioContent', 'audio_content', 'content', 'audio'];
const MIME_TYPE_KEYS = ['mimeType', 'mime_type', 'contentType', 'content_type', 'audioMimeType'];

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function findFirstValue(input, keys) {
  if (!input) return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const match = findFirstValue(item, keys);
      if (match) return match;
    }
    return null;
  }

  if (!isObject(input)) return null;

  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  for (const nested of Object.values(input)) {
    if (!nested || typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean') continue;
    const match = findFirstValue(nested, keys);
    if (match) return match;
  }

  return null;
}

function normalizeAudioBase64(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) {
    const [, base64Payload] = trimmed.split(',', 2);
    return base64Payload || null;
  }
  return trimmed;
}

export function normalizeSynthesisPayload(payload) {
  const audioUrl = findFirstValue(payload, AUDIO_URL_KEYS);
  const rawAudioBase64 = findFirstValue(payload, AUDIO_BASE64_KEYS);
  const mimeType = findFirstValue(payload, MIME_TYPE_KEYS) || 'audio/mpeg';
  return {
    audioUrl,
    audioBase64: normalizeAudioBase64(rawAudioBase64),
    mimeType
  };
}

router.get('/catalog', async (_req, res) => {
  const catalog = await getVoiceCatalog();
  res.json({ ...catalog, defaultVoiceId: DEFAULT_FREE_VOICE_ID, storeItems: buildVoiceStoreItems(catalog) });
});

router.post('/catalog/refresh', authenticate, async (_req, res) => {
  const catalog = await getVoiceCatalog({ forceRefresh: true });
  res.json({ ...catalog, defaultVoiceId: DEFAULT_FREE_VOICE_ID, storeItems: buildVoiceStoreItems(catalog) });
});

router.get('/inventory/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const user = await loadUser(accountId);
  if (!user) return res.status(404).json({ error: 'account not found' });

  const inventory = normalizeVoiceInventory(user.voiceCommentaryInventory);
  if (JSON.stringify(user.voiceCommentaryInventory || {}) !== JSON.stringify(inventory)) {
    user.voiceCommentaryInventory = inventory;
    await user.save();
  }
  return res.json({ accountId, inventory });
});

router.post('/select', authenticate, async (req, res) => {
  const { accountId, voiceId } = req.body || {};
  if (!accountId || !voiceId) {
    return res.status(400).json({ error: 'accountId and voiceId are required' });
  }

  const user = await loadUser(accountId);
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (req.auth?.telegramId && user.telegramId && req.auth.telegramId !== user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const inventory = normalizeVoiceInventory(user.voiceCommentaryInventory);
  if (!inventory.ownedVoiceIds.includes(voiceId)) {
    return res.status(400).json({ error: 'voice not owned' });
  }

  inventory.selectedVoiceId = voiceId;
  inventory.updatedAt = new Date().toISOString();
  user.voiceCommentaryInventory = inventory;
  await user.save();

  return res.json({ accountId, inventory });
});


router.post('/help', async (req, res) => {
  const { accountId, question, voiceId, locale } = req.body || {};
  const user = accountId ? await loadUser(accountId) : null;
  const inventory = normalizeVoiceInventory(user?.voiceCommentaryInventory);
  const catalog = await getVoiceCatalog();
  const selected = resolveSelectedVoice({
    catalogVoices: catalog.voices,
    inventory,
    overrideVoiceId: voiceId,
    overrideLocale: locale
  });

  if (!selected) {
    return res.status(503).json({ error: 'No PersonaPlex voices available in catalog' });
  }

  const answer = buildHelpAnswer(question);
  try {
    const synthesis = await synthesizeWithPersonaplex({
      text: answer,
      voiceId: selected.id,
      locale: selected.locale,
      metadata: {
        channel: 'help_center'
      }
    });
    return res.json({
      provider: 'nvidia-personaplex',
      voice: selected,
      answer,
      synthesis
    });
  } catch (error) {
    return res.json({
      provider: 'web-speech-fallback',
      voice: selected,
      answer,
      warning: `PersonaPlex synthesis unavailable: ${error.message}`
    });
  }
});

router.post('/speak', async (req, res) => {
  const { text, accountId, voiceId, locale, speaker } = req.body || {};
  const message = String(text || '').trim();
  if (!message) return res.status(400).json({ error: 'text is required' });

  const user = accountId ? await loadUser(accountId) : null;
  const inventory = normalizeVoiceInventory(user?.voiceCommentaryInventory);
  const catalog = await getVoiceCatalog();
  const selected = resolveSelectedVoice({
    catalogVoices: catalog.voices,
    inventory,
    overrideVoiceId: voiceId,
    overrideLocale: locale
  });

  if (!selected) {
    return res.status(503).json({ error: 'No PersonaPlex voices available in catalog' });
  }

  try {
    const synthesis = await synthesizeWithPersonaplex({
      text: message,
      voiceId: selected.id,
      locale: selected.locale,
      metadata: {
        channel: 'game_commentary',
        speaker: String(speaker || 'host')
      }
    });

    return res.json({
      provider: 'nvidia-personaplex',
      voice: selected,
      inventory,
      synthesis
    });
  } catch (error) {
    return res.json({
      provider: 'web-speech-fallback',
      voice: selected,
      inventory,
      text: message,
      warning: `PersonaPlex synthesis unavailable: ${error.message}`
    });
  }
});

export function applyVoiceCommentaryUnlocks(user, purchasedItems = [], catalogVoices = []) {
  const inventory = normalizeVoiceInventory(user.voiceCommentaryInventory || createDefaultVoiceInventory());
  const localeToVoiceIds = catalogVoices.reduce((acc, voice) => {
    const locale = String(voice.locale || '').toLowerCase();
    if (!locale) return acc;
    acc[locale] = acc[locale] || [];
    acc[locale].push(String(voice.id));
    return acc;
  }, {});

  purchasedItems.forEach((item) => {
    if (item.type !== 'voiceLanguage') return;
    const localeRaw = String(item.optionId || '');
    const localeKey = localeRaw.toLowerCase();
    const unlockedVoiceIds = localeToVoiceIds[localeKey] || [];
    if (localeRaw && !inventory.ownedLocales.includes(localeRaw)) inventory.ownedLocales.push(localeRaw);
    unlockedVoiceIds.forEach((voiceId) => {
      if (!inventory.ownedVoiceIds.includes(voiceId)) {
        inventory.ownedVoiceIds.push(voiceId);
      }
    });
  });

  inventory.updatedAt = new Date().toISOString();
  user.voiceCommentaryInventory = inventory;
}

export default router;

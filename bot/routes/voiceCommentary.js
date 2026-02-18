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
  return {
    provider: 'nvidia-personaplex',
    audioBase64: payload.audioBase64 || payload.audio_base64 || null,
    audioUrl: payload.audioUrl || payload.audio_url || null,
    mimeType: payload.mimeType || payload.mime_type || 'audio/mpeg',
    raw: payload
  };
}

async function synthesizeWithPersonaPlexService({ text, voiceId, locale, metadata = {} }) {
  const endpoint = process.env.PERSONAPLEX_SERVICE_URL || 'http://127.0.0.1:8090';
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceId,
      personaPrompt: metadata?.personaPrompt,
      format: 'wav',
      sampleRate: 22050,
      locale,
      metadata
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PersonaPlex service failed (${response.status}): ${details}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('audio/wav') || contentType.includes('application/octet-stream')) {
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      provider: 'nvidia-personaplex',
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/wav'
    };
  }

  const payload = await response.json();
  return {
    provider: 'nvidia-personaplex',
    audioBase64: payload.audioBase64 || payload.audio_base64 || null,
    audioUrl: payload.audioUrl || payload.audio_url || null,
    mimeType: payload.mimeType || payload.mime_type || 'audio/wav',
    raw: payload
  };
}

function resolvePersonaPlexModes() {
  const configured = String(process.env.PERSONAPLEX_MODE || 'auto').toLowerCase();
  if (configured === 'service') return ['service'];
  if (configured === 'remote-api') return ['remote-api'];

  const modes = [];
  if (process.env.PERSONAPLEX_API_URL) modes.push('remote-api');
  if (process.env.PERSONAPLEX_SERVICE_URL) modes.push('service');
  if (!modes.length) modes.push('service');
  return modes;
}

async function synthesizeVoice(args) {
  const provider = String(process.env.VOICE_PROVIDER || 'personaplex').toLowerCase();
  if (provider !== 'personaplex') {
    throw new Error('Current provider selected; using client-side speech fallback.');
  }

  const modes = resolvePersonaPlexModes();
  let lastError = null;
  for (const mode of modes) {
    try {
      return mode === 'remote-api' ? await synthesizeWithPersonaplex(args) : await synthesizeWithPersonaPlexService(args);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('PersonaPlex synthesis unavailable');
}

export { synthesizeVoice };

router.get('/catalog', async (_req, res) => {
  const catalog = await getVoiceCatalog();
  res.json({ ...catalog, defaultVoiceId: DEFAULT_FREE_VOICE_ID, storeItems: buildVoiceStoreItems(catalog) });
});

router.get('/health', async (_req, res) => {
  const provider = String(process.env.VOICE_PROVIDER || 'personaplex').toLowerCase();
  if (provider !== 'personaplex') {
    return res.json({ ok: true, provider: 'current', modelLoaded: false, fallback: 'web-speech' });
  }

  const modes = resolvePersonaPlexModes();

  if (modes.includes('service')) {
    try {
      const endpoint = process.env.PERSONAPLEX_SERVICE_URL || 'http://127.0.0.1:8090';
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/health`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const payload = await response.json();
      return res.json({ ok: true, provider: 'personaplex', mode: 'service', ...payload });
    } catch {
      // try next mode
    }
  }

  if (modes.includes('remote-api') && process.env.PERSONAPLEX_API_URL) {
    return res.json({ ok: true, provider: 'personaplex', mode: 'remote-api', modelLoaded: true });
  }

  return res.status(503).json({ ok: false, provider: 'personaplex', error: 'No healthy PersonaPlex mode available' });
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
    const synthesis = await synthesizeVoice({
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
  const { text, accountId, voiceId, locale, speaker, personaPrompt, context, gameId } = req.body || {};
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
    const synthesis = await synthesizeVoice({
      text: message,
      voiceId: selected.id,
      locale: selected.locale,
      metadata: {
        channel: context === 'help' ? 'help_center' : 'game_commentary',
        speaker: String(speaker || 'host'),
        gameId: String(gameId || ''),
        personaPrompt: String(personaPrompt || '')
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

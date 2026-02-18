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
import { synthesizeWithPersonaPlex } from '../utils/personaplexSynthesis.js';

const router = Router();

async function loadUser(accountId) {
  if (!accountId) return null;
  return User.findOne({ accountId });
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


router.post('/speak', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const speaker = String(req.body?.speaker || 'narrator');
  const accountId = String(req.body?.accountId || '');
  if (!text) return res.status(400).json({ error: 'text is required' });

  const catalog = await getVoiceCatalog();
  let voiceId = String(req.body?.voiceId || '').trim();
  let locale = String(req.body?.locale || '').trim();

  if (accountId) {
    const user = await loadUser(accountId);
    if (user) {
      const inventory = normalizeVoiceInventory(user.voiceCommentaryInventory);
      if (!voiceId) voiceId = inventory.selectedVoiceId;
    }
  }

  const selectedVoice = catalog.voices.find((voice) => voice.id === voiceId)
    || catalog.voices.find((voice) => voice.id === DEFAULT_FREE_VOICE_ID)
    || catalog.voices[0];

  if (!selectedVoice) {
    return res.status(503).json({ error: 'No PersonaPlex voices available' });
  }

  if (!voiceId) voiceId = selectedVoice.id;
  if (!locale) locale = selectedVoice.locale || 'en-US';

  try {
    const synthesis = await synthesizeWithPersonaPlex({
      text,
      voiceId,
      locale,
      metadata: { speaker, channel: 'game_commentary' }
    });

    return res.json({
      voiceId,
      locale,
      audioSource: synthesis.audioSource
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
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

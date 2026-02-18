import { get, post } from './api.js';
import { VOICE_COMMENTARY_DEFAULT_VOICE_ID } from '../config/voiceCommentaryInventoryConfig.js';

const STORAGE_PREFIX = 'tpg.voiceCommentary';
const DEFAULT_LOCALE = 'en-US';

const buildStorageKey = (accountId = 'guest') => `${STORAGE_PREFIX}.${accountId || 'guest'}`;

const createDefault = () => ({
  ownedVoiceIds: [VOICE_COMMENTARY_DEFAULT_VOICE_ID],
  ownedLocales: [DEFAULT_LOCALE],
  selectedVoiceId: VOICE_COMMENTARY_DEFAULT_VOICE_ID,
  updatedAt: new Date().toISOString()
});

export const normalizeVoiceInventory = (inventory) => {
  const base = createDefault();
  if (!inventory || typeof inventory !== 'object') return base;
  const ownedVoiceIds = new Set([VOICE_COMMENTARY_DEFAULT_VOICE_ID]);
  const ownedLocales = new Set([DEFAULT_LOCALE]);
  if (Array.isArray(inventory.ownedVoiceIds)) {
    inventory.ownedVoiceIds.forEach((voiceId) => {
      if (voiceId) ownedVoiceIds.add(String(voiceId));
    });
  }
  if (Array.isArray(inventory.ownedLocales)) {
    inventory.ownedLocales.forEach((locale) => {
      if (locale) ownedLocales.add(String(locale));
    });
  }
  const selectedVoiceId = ownedVoiceIds.has(inventory.selectedVoiceId)
    ? inventory.selectedVoiceId
    : VOICE_COMMENTARY_DEFAULT_VOICE_ID;
  return {
    ownedVoiceIds: Array.from(ownedVoiceIds),
    ownedLocales: Array.from(ownedLocales),
    selectedVoiceId,
    updatedAt: inventory.updatedAt || base.updatedAt
  };
};

export const getVoiceCommentaryInventory = (accountId = 'guest') => {
  if (typeof window === 'undefined') return createDefault();
  try {
    const raw = window.localStorage.getItem(buildStorageKey(accountId));
    if (!raw) return createDefault();
    return normalizeVoiceInventory(JSON.parse(raw));
  } catch {
    return createDefault();
  }
};

export const saveVoiceCommentaryInventory = (accountId = 'guest', inventory) => {
  const normalized = normalizeVoiceInventory(inventory);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(buildStorageKey(accountId), JSON.stringify(normalized));
  }
  return normalized;
};

export const isVoiceCommentaryUnlocked = (_type, optionId, inventory) =>
  normalizeVoiceInventory(inventory).ownedLocales.includes(String(optionId || ''));

export async function loadVoiceCommentaryCatalog() {
  return get('/api/voice-commentary/catalog');
}

export async function syncVoiceCommentaryInventory(accountId) {
  if (!accountId || accountId === 'guest') return getVoiceCommentaryInventory(accountId);
  const res = await get(`/api/voice-commentary/inventory/${accountId}`);
  if (res?.inventory) return saveVoiceCommentaryInventory(accountId, res.inventory);
  return getVoiceCommentaryInventory(accountId);
}

export async function selectVoiceCommentary(accountId, voiceId) {
  if (!accountId || accountId === 'guest') {
    const current = getVoiceCommentaryInventory(accountId);
    if (!current.ownedVoiceIds.includes(voiceId)) return current;
    return saveVoiceCommentaryInventory(accountId, { ...current, selectedVoiceId: voiceId });
  }
  const res = await post('/api/voice-commentary/select', { accountId, voiceId });
  if (res?.inventory) return saveVoiceCommentaryInventory(accountId, res.inventory);
  return getVoiceCommentaryInventory(accountId);
}

export async function addVoiceCommentaryUnlock(_type, _optionId, accountId) {
  return syncVoiceCommentaryInventory(accountId);
}

export const listOwnedVoiceCommentaryOptions = (inventory) =>
  normalizeVoiceInventory(inventory).ownedLocales.map((locale) => ({
    type: 'voiceLanguage',
    optionId: locale,
    label: locale
  }));

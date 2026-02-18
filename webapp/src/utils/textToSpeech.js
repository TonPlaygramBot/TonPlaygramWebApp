import { post } from './api.js';

const SPEECH_SUPPORT_EVENT = 'tonplaygram:speech-support';
let supportState = true;
let activeAudio = null;

const emitSpeechSupport = (supported) => {
  if (typeof window === 'undefined') return;
  if (supportState === supported) return;
  supportState = supported;
  if (typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SPEECH_SUPPORT_EVENT, { detail: { supported } }));
  } else {
    window.dispatchEvent(new Event(SPEECH_SUPPORT_EVENT));
  }
};

const getLocalInventory = () => {
  if (typeof window === 'undefined') return null;
  const accountId = window.localStorage.getItem('accountId') || 'guest';
  const raw = window.localStorage.getItem(`tpg.voiceCommentary.${accountId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolveSelectedVoice = () => {
  const inventory = getLocalInventory();
  const selectedVoiceId = String(inventory?.selectedVoiceId || '').trim();
  const selectedLocale = Array.isArray(inventory?.ownedLocales) && inventory.ownedLocales.length
    ? String(inventory.ownedLocales[0])
    : undefined;
  return { selectedVoiceId, selectedLocale };
};

const stopAudio = () => {
  if (!activeAudio) return;
  try {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch {}
  activeAudio = null;
};

const playAudioSource = (audioSource) =>
  new Promise((resolve) => {
    if (typeof Audio === 'undefined' || !audioSource) {
      resolve();
      return;
    }

    stopAudio();
    const audio = new Audio(audioSource);
    activeAudio = audio;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };

    audio.onended = finish;
    audio.onerror = finish;

    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => finish());
    }
    setTimeout(finish, Math.max(2400, String(audioSource).length / 4));
  });

export const installSpeechSynthesisUnlock = () => {
  emitSpeechSupport(true);
};

export const getSpeechSynthesis = () => null;

export const getSpeechSupport = () => true;

export const onSpeechSupportChange = (callback) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (event?.detail && typeof event.detail.supported === 'boolean') {
      callback(event.detail.supported);
    } else {
      callback(getSpeechSupport());
    }
  };
  window.addEventListener(SPEECH_SUPPORT_EVENT, handler);
  return () => window.removeEventListener(SPEECH_SUPPORT_EVENT, handler);
};

export const primeSpeechSynthesis = () => {};

export const resolveVoiceForSpeaker = () => null;

export const speakCommentaryLines = async (lines) => {
  if (!Array.isArray(lines) || !lines.length) return;

  const accountId = typeof window !== 'undefined' ? window.localStorage.getItem('accountId') || undefined : undefined;
  const { selectedVoiceId, selectedLocale } = resolveSelectedVoice();

  for (const line of lines) {
    const text = String(line?.text || '').trim();
    if (!text) continue;
    const response = await post('/api/voice-commentary/speak', {
      accountId,
      speaker: line?.speaker || 'narrator',
      text,
      voiceId: selectedVoiceId || undefined,
      locale: selectedLocale || undefined
    });

    if (response?.error || !response?.audioSource) {
      emitSpeechSupport(false);
      continue;
    }

    emitSpeechSupport(true);
    await playAudioSource(response.audioSource);
  }
};

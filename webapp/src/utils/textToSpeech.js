import { post } from './api.js';

let commentarySupport = true;
const listeners = new Set();

const emitSupport = (supported) => {
  if (commentarySupport === supported) return;
  commentarySupport = supported;
  listeners.forEach((listener) => {
    try {
      listener(supported);
    } catch {
      // no-op
    }
  });
};

const getCurrentAccountId = () => {
  if (typeof window === 'undefined') return 'guest';
  return window.localStorage.getItem('accountId') || 'guest';
};

const playAudioPayload = async (payload) => {
  const synthesis = payload?.synthesis || {};
  const audioUrl = synthesis.audioUrl;
  const audioBase64 = synthesis.audioBase64;
  const mimeType = synthesis.mimeType || 'audio/mpeg';
  if (!audioUrl && !audioBase64) {
    throw new Error('PersonaPlex response missing audio payload');
  }
  const source = audioUrl || `data:${mimeType};base64,${audioBase64}`;
  const audio = new Audio(source);
  await new Promise((resolve, reject) => {
    const onDone = () => {
      audio.removeEventListener('ended', onDone);
      audio.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      audio.removeEventListener('ended', onDone);
      audio.removeEventListener('error', onError);
      reject(new Error('Audio playback failed'));
    };
    audio.addEventListener('ended', onDone);
    audio.addEventListener('error', onError);
    audio.play().catch(onError);
  });
};

export const installSpeechSynthesisUnlock = () => {
  // No-op: commentary now uses PersonaPlex audio streaming only.
};

export const getSpeechSynthesis = () => null;

export const getSpeechSupport = () => commentarySupport;

export const onSpeechSupportChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const primeSpeechSynthesis = () => {
  // No-op: commentary now uses PersonaPlex audio streaming only.
};

export const resolveVoiceForSpeaker = () => null;

export const speakCommentaryLines = async (
  lines,
  { voiceHints = {}, speakerSettings = {} } = {}
) => {
  if (!Array.isArray(lines) || !lines.length || typeof window === 'undefined') return;

  const accountId = getCurrentAccountId();

  for (const line of lines) {
    const text = String(line?.text || '').trim();
    if (!text) continue;

    const speaker = line?.speaker || 'Host';
    const hints = Array.isArray(voiceHints[speaker]) ? voiceHints[speaker] : [];
    const localeHint = hints.find((hint) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(hint || '')));

    const payload = await post('/api/voice-commentary/speak', {
      accountId,
      text,
      speaker,
      locale: localeHint,
      style: speakerSettings[speaker] || null
    });

    if (payload?.error) {
      emitSupport(false);
      throw new Error(payload.error);
    }

    emitSupport(true);
    await playAudioPayload(payload);
  }
};

import { API_BASE_URL } from './api.js';

const REMOTE_TTS_PATH = '/api/voice/speak';

const buildUrl = () => `${API_BASE_URL}${REMOTE_TTS_PATH}`;

const playBlobAudio = (blob, volume = 1) =>
  new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.volume = volume;
    const cleanup = () => {
      URL.revokeObjectURL(audio.src);
      resolve();
    };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup);
  });

export const speakRemoteLine = async ({ text, lang = 'en', voice, volume = 1 }) => {
  if (!text) return false;
  try {
    const response = await fetch(buildUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: lang, voice, format: 'mp3' })
    });
    if (!response.ok) return false;
    const blob = await response.blob();
    await playBlobAudio(blob, volume);
    return true;
  } catch {
    return false;
  }
};

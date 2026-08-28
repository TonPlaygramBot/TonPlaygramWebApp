const listeners = new Set();

export const installSpeechSynthesisUnlock = () => {};

export const getSpeechSynthesis = () =>
  typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;

export const getSpeechSupport = () =>
  typeof window !== 'undefined' && Boolean(getSpeechSynthesis() && window.SpeechSynthesisUtterance);

export const onSpeechSupportChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  listeners.add(callback);
  callback(false);
  return () => listeners.delete(callback);
};

export const primeSpeechSynthesis = () => Promise.resolve(getSpeechSupport());

export const resolveVoiceForSpeaker = (_speaker, localeHints = []) => {
  const voices = getSpeechSynthesis()?.getVoices?.() || [];
  const hints = Array.isArray(localeHints) ? localeHints : [localeHints];
  return voices.find((voice) => hints.some((hint) => voice.lang?.toLowerCase().startsWith(String(hint).toLowerCase()))) || voices.find((voice) => voice.default) || voices[0] || null;
};

export const speakCommentaryLines = async (lines = [], { voiceHints = {} } = {}) => {
  const synthesis = getSpeechSynthesis();
  if (!synthesis || typeof window.SpeechSynthesisUtterance !== 'function') return false;
  for (const line of lines) {
    const utterance = new window.SpeechSynthesisUtterance(line?.text || String(line || ''));
    const voice = resolveVoiceForSpeaker(line?.speaker, voiceHints[line?.speaker] || []);
    if (voice) utterance.voice = voice;
    await new Promise((resolve) => {
      utterance.onend = resolve;
      utterance.onerror = resolve;
      synthesis.speak(utterance);
    });
  }
  return true;
};

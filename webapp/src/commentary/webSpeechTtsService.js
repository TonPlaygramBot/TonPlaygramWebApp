const DEFAULT_SETTINGS = {
  rate: 1,
  pitch: 1,
  volume: 1,
  locale: 'en-US'
};

const ensureVoices = (synth, timeoutMs = 1200) =>
  new Promise((resolve) => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    let settled = false;
    const handleVoices = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', handleVoices);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', handleVoices);
    window.setTimeout(handleVoices, timeoutMs);
  });

const pickVoice = (voices, { voiceId, locale }) => {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const normalized = voiceId ? String(voiceId).toLowerCase() : '';
  if (normalized) {
    const matched =
      voices.find((voice) => voice.name.toLowerCase().includes(normalized)) ||
      voices.find((voice) => voice.voiceURI?.toLowerCase().includes(normalized));
    if (matched) return matched;
  }
  const localeLower = String(locale || '').toLowerCase();
  const localeMatch = voices.find((voice) =>
    voice.lang?.toLowerCase().startsWith(localeLower)
  );
  if (localeMatch) return localeMatch;
  const english = voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
  return english || voices[0];
};

export class WebSpeechTtsService {
  constructor({ getMuted, getVolume, settings } = {}) {
    this.getMuted = typeof getMuted === 'function' ? getMuted : () => false;
    this.getVolume = typeof getVolume === 'function' ? getVolume : () => 1;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.pendingUtterances = new Set();
  }

  async speak(text, overrides = {}) {
    if (this.getMuted?.()) return null;
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const merged = { ...this.settings, ...overrides };
    const synth = window.speechSynthesis;
    const voices = await ensureVoices(synth);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voices, { voiceId: merged.voiceId, locale: merged.locale });
    if (voice) utterance.voice = voice;
    utterance.rate = Number.isFinite(merged.rate) ? merged.rate : DEFAULT_SETTINGS.rate;
    utterance.pitch = Number.isFinite(merged.pitch) ? merged.pitch : DEFAULT_SETTINGS.pitch;
    const resolvedVolume = Number.isFinite(merged.volume)
      ? merged.volume
      : this.getVolume?.() ?? DEFAULT_SETTINGS.volume;
    utterance.volume = Math.max(0, Math.min(1, resolvedVolume));

    return new Promise((resolve) => {
      const cleanup = () => {
        this.pendingUtterances.delete(utterance);
      };
      utterance.onend = () => {
        cleanup();
        resolve({ utterance, text });
      };
      utterance.onerror = () => {
        cleanup();
        resolve(null);
      };
      this.pendingUtterances.add(utterance);
      synth.speak(utterance);
    });
  }

  stop() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    this.pendingUtterances.clear();
  }
}

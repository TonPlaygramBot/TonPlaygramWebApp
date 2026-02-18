import type { VoiceProvider, VoiceSpeakOptions } from '../VoiceProvider';

const pickSpeechSynthesisVoice = (hints: string[] = []) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (!voices.length) return null;

  const normalizedHints = hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean);
  for (const hint of normalizedHints) {
    const byLang = voices.find((voice) => String(voice.lang || '').toLowerCase() === hint);
    if (byLang) return byLang;
    const byPrefix = voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(`${hint}-`));
    if (byPrefix) return byPrefix;
    const byName = voices.find((voice) => String(voice.name || '').toLowerCase().includes(hint));
    if (byName) return byName;
  }

  return voices.find((voice) => voice.default) || voices[0] || null;
};

export class CurrentVoiceProvider implements VoiceProvider {
  private currentAudio: HTMLAudioElement | null = null;

  async speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement> {
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis ||
      !window.SpeechSynthesisUtterance ||
      !String(text || '').trim()
    ) {
      throw new Error('Web Speech is unavailable');
    }

    const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim());
    const preferredVoice = pickSpeechSynthesisVoice(opts.hints || []);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      if (preferredVoice.lang) utterance.lang = preferredVoice.lang;
    }
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const audio = new Audio();
    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error('Web Speech playback failed'));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

    this.currentAudio = audio;
    return audio;
  }

  stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  async healthCheck() {
    return typeof window !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }
}

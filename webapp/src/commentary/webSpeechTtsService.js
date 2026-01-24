const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
};

export class WebSpeechTtsService {
  constructor({ volume, onSpeakStart } = {}) {
    this.volume = volume;
    this.onSpeakStart = onSpeakStart;
  }

  async speak(text) {
    if (typeof window === 'undefined') return null;
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return null;
    const utterance = new window.SpeechSynthesisUtterance(text);
    const resolvedVolume =
      typeof this.volume === 'function' ? this.volume() : this.volume ?? 1;
    utterance.volume = clamp01(resolvedVolume);

    return new Promise((resolve) => {
      utterance.onend = () => resolve({ text });
      utterance.onerror = () => resolve(null);
      synth.speak(utterance);
      if (this.onSpeakStart) this.onSpeakStart();
      if (synth.paused) {
        try {
          synth.resume();
        } catch {}
      }
    });
  }

  cancel() {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      synth.cancel();
    } catch {}
  }
}

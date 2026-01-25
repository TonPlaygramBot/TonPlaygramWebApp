const DEFAULT_VOICE_HINTS = {
  Steven: ['en-GB', 'English', 'Male', 'Google UK English Male'],
  John: ['en-US', 'English', 'Male', 'Google US English']
};

const DEFAULT_SPEAKER_SETTINGS = {
  Steven: { rate: 1, pitch: 0.95, volume: 1 },
  John: { rate: 1.02, pitch: 1.05, volume: 1 }
};

export const getSpeechSynthesis = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

const loadVoices = (synth, timeoutMs = 2500) =>
  new Promise((resolve) => {
    if (!synth) {
      resolve([]);
      return;
    }
    const existing = synth.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finalize = (voices) => {
      if (settled) return;
      settled = true;
      resolve(voices);
    };
    const handleVoices = () => {
      const next = synth.getVoices();
      if (next.length) finalize(next);
    };
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', handleVoices, { once: true });
    } else {
      synth.onvoiceschanged = handleVoices;
    }
    setTimeout(() => finalize(synth.getVoices()), timeoutMs);
  });

const findVoiceMatch = (voices, hints = []) => {
  const normalizedHints = hints.map((hint) => hint.toLowerCase());
  return (
    voices.find((voice) => normalizedHints.some((hint) => voice.name.toLowerCase().includes(hint))) ||
    voices.find((voice) => normalizedHints.some((hint) => voice.lang.toLowerCase().includes(hint))) ||
    voices[0] ||
    null
  );
};

export const resolveVoiceForSpeaker = (speaker, voices = []) => {
  if (!voices.length) return null;
  const hints = DEFAULT_VOICE_HINTS[speaker] || DEFAULT_VOICE_HINTS.Steven;
  return findVoiceMatch(voices, hints);
};

export const speakCommentaryLines = async (lines, {
  speakerSettings = DEFAULT_SPEAKER_SETTINGS,
  voiceHints = DEFAULT_VOICE_HINTS
} = {}) => {
  const synth = getSpeechSynthesis();
  if (!synth || !Array.isArray(lines) || lines.length === 0) return;

  const voices = await loadVoices(synth);

  if (typeof synth.resume === 'function') {
    try {
      synth.resume();
    } catch {}
  }

  for (const line of lines) {
    const speaker = line.speaker || 'Steven';
    const settings = speakerSettings[speaker] || DEFAULT_SPEAKER_SETTINGS.Steven;
    const utterance = new SpeechSynthesisUtterance(line.text);
    const voice = findVoiceMatch(voices, voiceHints[speaker] || voiceHints.Steven);

    if (voice) utterance.voice = voice;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    await new Promise((resolve) => {
      utterance.onend = resolve;
      utterance.onerror = resolve;
      synth.speak(utterance);
    });
  }
};

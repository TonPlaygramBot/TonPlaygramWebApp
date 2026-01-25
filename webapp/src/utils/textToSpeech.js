const DEFAULT_VOICE_HINTS = {
  Mason: ['en-US', 'English', 'Male', 'Google US English Male', 'David', 'Guy'],
  Lena: ['en-GB', 'English', 'Female', 'Google UK English Female', 'Sonia', 'Hazel']
};

const DEFAULT_SPEAKER_SETTINGS = {
  Mason: { rate: 1, pitch: 0.95, volume: 1 },
  Lena: { rate: 1.02, pitch: 1.05, volume: 1 }
};

export const getSpeechSynthesis = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export const primeSpeechSynthesis = () => {
  const synth = getSpeechSynthesis();
  if (!synth || synth.speaking || synth.pending) return;
  if (typeof synth.getVoices === 'function') {
    try {
      synth.getVoices();
    } catch {}
  }
  if (typeof synth.resume === 'function') {
    try {
      synth.resume();
    } catch {}
  }
  const utterance = new SpeechSynthesisUtterance(' ');
  utterance.volume = 0.01;
  utterance.rate = 1;
  utterance.pitch = 1;
  if (typeof navigator !== 'undefined' && navigator.language) {
    utterance.lang = navigator.language;
  }
  utterance.onend = () => {
    if (typeof synth.cancel === 'function') {
      try {
        synth.cancel();
      } catch {}
    }
  };
  utterance.onerror = utterance.onend;
  synth.speak(utterance);
};

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

const findDistinctVoice = (voices, hints = [], usedVoices = new Set()) => {
  if (!voices.length) return null;
  const normalizedHints = hints.map((hint) => hint.toLowerCase());
  const matchesByName = voices.filter((voice) =>
    normalizedHints.some((hint) => voice.name.toLowerCase().includes(hint))
  );
  const matchesByLang = voices.filter((voice) =>
    normalizedHints.some((hint) => voice.lang.toLowerCase().includes(hint))
  );
  const candidateLists = [matchesByName, matchesByLang, voices];
  for (const candidates of candidateLists) {
    const match = candidates.find((voice) => !usedVoices.has(voice));
    if (match) return match;
  }
  return voices[0] || null;
};

const resolveHintedLanguage = (hints = [], fallback) => {
  const normalizedHints = hints.map((hint) => String(hint || '').trim()).filter(Boolean);
  const matched = normalizedHints.find((hint) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(hint));
  if (matched) return matched;
  if (fallback) return fallback;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
};

export const resolveVoiceForSpeaker = (speaker, voices = []) => {
  if (!voices.length) return null;
  const hints = DEFAULT_VOICE_HINTS[speaker] || DEFAULT_VOICE_HINTS.Mason;
  return findVoiceMatch(voices, hints);
};

export const speakCommentaryLines = async (lines, {
  speakerSettings = DEFAULT_SPEAKER_SETTINGS,
  voiceHints = DEFAULT_VOICE_HINTS
} = {}) => {
  const synth = getSpeechSynthesis();
  if (!synth || !Array.isArray(lines) || lines.length === 0) return;

  const voices = await loadVoices(synth);
  const uniqueSpeakers = [...new Set(lines.map((line) => line.speaker || 'Mason'))];
  const usedVoices = new Set();
  const speakerVoices = uniqueSpeakers.reduce((acc, speaker) => {
    const voice = findDistinctVoice(voices, voiceHints[speaker] || voiceHints.Mason, usedVoices);
    if (voice) {
      usedVoices.add(voice);
      acc[speaker] = voice;
    }
    return acc;
  }, {});

  if (typeof synth.resume === 'function') {
    try {
      synth.resume();
    } catch {}
  }

  for (const line of lines) {
    const speaker = line.speaker || 'Mason';
    const settings = speakerSettings[speaker] || DEFAULT_SPEAKER_SETTINGS.Mason;
    const utterance = new SpeechSynthesisUtterance(line.text);
    const voice = speakerVoices[speaker] || findVoiceMatch(voices, voiceHints[speaker] || voiceHints.Mason);
    const fallbackLang = resolveHintedLanguage(voiceHints[speaker] || voiceHints.Mason);

    if (voice) {
      utterance.voice = voice;
      if (voice.lang) utterance.lang = voice.lang;
    } else {
      utterance.lang = fallbackLang;
    }
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

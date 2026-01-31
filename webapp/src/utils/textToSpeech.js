const DEFAULT_VOICE_HINTS = {
  Mason: ['en-US', 'English', 'Male', 'Google US English Male', 'David', 'Guy'],
  Lena: ['en-GB', 'English', 'Female', 'Google UK English Female', 'Sonia', 'Hazel']
};

const DEFAULT_SPEAKER_SETTINGS = {
  Mason: { rate: 1, pitch: 0.95, volume: 1 },
  Lena: { rate: 1.02, pitch: 1.05, volume: 1 }
};

let audioContext;
let audioContextUnlocked = false;
let speechUnlockInstalled = false;
let speechUnlockHandler;
let speechUnlockVisibilityHandler;

const ensureAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    try {
      audioContext = new AudioContextClass();
    } catch (error) {
      audioContext = null;
    }
  }
  return audioContext;
};

const unlockAudioContext = () => {
  const ctx = ensureAudioContext();
  if (!ctx || audioContextUnlocked) return;
  const resumeContext = typeof ctx.resume === 'function' ? ctx.resume() : Promise.resolve();
  Promise.resolve(resumeContext)
    .catch(() => {})
    .finally(() => {
      if (!ctx || audioContextUnlocked) return;
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        if (typeof source.stop === 'function') {
          source.stop(0);
        }
        audioContextUnlocked = true;
      } catch {
        audioContextUnlocked = false;
      }
    });
};

const createSpeechUnlockHandler = () => {
  if (speechUnlockHandler) return speechUnlockHandler;
  speechUnlockHandler = () => {
    const synth = getSpeechSynthesis();
    if (!synth) return;
    ensureSpeechUnlocked(synth);
    primeSpeechSynthesis();
  };
  return speechUnlockHandler;
};

export const installSpeechSynthesisUnlock = () => {
  if (typeof window === 'undefined' || speechUnlockInstalled) return;
  speechUnlockInstalled = true;
  const handler = createSpeechUnlockHandler();
  const isTelegram = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp);
  const options = { once: !isTelegram, passive: true };
  window.addEventListener('pointerdown', handler, options);
  window.addEventListener('touchstart', handler, options);
  window.addEventListener('touchend', handler, options);
  window.addEventListener('click', handler, options);
  window.addEventListener('keydown', handler, options);
  if (isTelegram) {
    speechUnlockVisibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        handler();
      }
    };
    window.addEventListener('focus', handler, { passive: true });
    document.addEventListener('visibilitychange', speechUnlockVisibilityHandler, { passive: true });
  }
};

export const getSpeechSynthesis = () => {
  if (typeof window === 'undefined') return null;
  let synth = null;
  try {
    synth = window.speechSynthesis;
  } catch {
    synth = null;
  }
  if (!synth) {
    try {
      synth = window.webkitSpeechSynthesis;
    } catch {
      synth = null;
    }
  }
  if (!synth || typeof synth.speak !== 'function') return null;
  return synth;
};

const ensureSpeechUnlocked = (synth) => {
  if (!synth) return;
  unlockAudioContext();
  if (typeof synth.resume === 'function') {
    try {
      synth.resume();
    } catch {}
  }
  if (typeof synth.getVoices === 'function') {
    try {
      synth.getVoices();
    } catch {}
  }
};

export const primeSpeechSynthesis = () => {
  const synth = getSpeechSynthesis();
  if (!synth || synth.speaking || synth.pending || typeof SpeechSynthesisUtterance === 'undefined') return;
  ensureSpeechUnlocked(synth);
  const utterance = new SpeechSynthesisUtterance('.');
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
  try {
    synth.speak(utterance);
  } catch {
    if (typeof synth.cancel === 'function') {
      try {
        synth.cancel();
      } catch {}
    }
  }
};

const safeGetVoices = (synth) => {
  if (!synth || typeof synth.getVoices !== 'function') return [];
  try {
    return synth.getVoices() || [];
  } catch {
    return [];
  }
};

const loadVoices = (synth, timeoutMs = 3500) =>
  new Promise((resolve) => {
    if (!synth) {
      resolve([]);
      return;
    }
    ensureSpeechUnlocked(synth);
    if (typeof SpeechSynthesisUtterance !== 'undefined') {
      primeSpeechSynthesis();
    }
    const existing = safeGetVoices(synth);
    if (existing.length) {
      resolve(existing);
      return;
    }
    let settled = false;
    let intervalId = null;
    const finalize = (voices) => {
      if (settled) return;
      settled = true;
      if (intervalId) clearInterval(intervalId);
      resolve(voices);
    };
    const handleVoices = () => {
      const next = safeGetVoices(synth);
      if (next.length) finalize(next);
    };
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', handleVoices, { once: true });
    } else {
      synth.onvoiceschanged = handleVoices;
    }
    intervalId = setInterval(handleVoices, 250);
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

export const speakCommentaryLines = async (
  lines,
  { speakerSettings = DEFAULT_SPEAKER_SETTINGS, voiceHints = DEFAULT_VOICE_HINTS } = {}
) => {
  const synth = getSpeechSynthesis();
  if (
    !synth ||
    typeof SpeechSynthesisUtterance === 'undefined' ||
    !Array.isArray(lines) ||
    lines.length === 0
  ) {
    return;
  }

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

  ensureSpeechUnlocked(synth);

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
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const fallbackMs = Math.max(1800, line.text.length * 60);
      const timeoutId = setTimeout(finish, fallbackMs);
      utterance.onend = () => {
        clearTimeout(timeoutId);
        finish();
      };
      utterance.onerror = () => {
        clearTimeout(timeoutId);
        finish();
      };
      if (synth.speaking || synth.pending) {
        try {
          synth.cancel();
        } catch {}
      }
      try {
        synth.speak(utterance);
        setTimeout(() => ensureSpeechUnlocked(synth), 0);
      } catch {
        clearTimeout(timeoutId);
        finish();
      }
    });
  }
};

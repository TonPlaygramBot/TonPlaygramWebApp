import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPersonaPlexVoices,
  getSelectedVoicePromptId,
  getSpeechSupport,
  setSelectedVoicePromptId,
  speakCommentaryLines
} from '../utils/textToSpeech.js';
import {
  buildStructuredResponse,
  isSensitiveHelpRequest,
  searchLocalHelp
} from '../utils/platformHelpLocalSearch.js';

const SPEECH_RECOGNITION_ERROR =
  'Voice input is unavailable on this device/browser. Please use a supported browser for voice help.';

const DEFAULT_LANGUAGES = [
  { locale: 'en-US', language: 'English' },
  { locale: 'sq-AL', language: 'Albanian' },
  { locale: 'es-ES', language: 'Spanish' },
  { locale: 'pt-BR', language: 'Portuguese' },
  { locale: 'tr-TR', language: 'Turkish' }
];

const LOCALE_TO_FLAG = {
  'en-US': '🇺🇸',
  'sq-AL': '🇦🇱',
  'es-ES': '🇪🇸',
  'es-MX': '🇲🇽',
  'fr-FR': '🇫🇷',
  'de-DE': '🇩🇪',
  'it-IT': '🇮🇹',
  'ja-JP': '🇯🇵',
  'ko-KR': '🇰🇷',
  'hi-IN': '🇮🇳',
  'ar-SA': '🇸🇦',
  'tr-TR': '🇹🇷',
  'pt-BR': '🇧🇷',
  'uk-UA': '🇺🇦',
  'pl-PL': '🇵🇱'
};

function createSpeechRecognition(locale = 'en-US') {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = locale;
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

export default function PlatformHelpAgentCard({ onClose = null }) {
  const [answer, setAnswer] = useState(
    'Voice help is ready. Tap your language flag, then tap Open Mic and speak.'
  );
  const [citations, setCitations] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const [supportedLanguages, setSupportedLanguages] = useState(DEFAULT_LANGUAGES);
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [voicePromptId, setVoicePromptId] = useState(() => getSelectedVoicePromptId());
  const [micReady, setMicReady] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  const canUseSpeechInput = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const canUseSpeechOutput = useMemo(() => Boolean(getSpeechSupport()), []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    let cancelled = false;

    const loadVoiceLanguages = async () => {
      try {
        const response = await fetch('/v1/voice/catalog');
        if (!response.ok) return;
        const payload = await response.json();
        const voices = Array.isArray(payload?.voices) ? payload.voices : [];
        const uniqueByLocale = new Map();
        voices.forEach((voice) => {
          const locale = String(voice?.locale || '').trim();
          const language = String(voice?.language || '').trim();
          if (!locale || !language || uniqueByLocale.has(locale)) return;
          uniqueByLocale.set(locale, { locale, language });
        });

        const items = Array.from(uniqueByLocale.values()).sort((a, b) => a.language.localeCompare(b.language));
        if (!cancelled && items.length) {
          setSupportedLanguages(items);
          if (!items.some((item) => item.locale === selectedLocale)) {
            setSelectedLocale(items[0].locale);
          }
        }
      } catch {
        // Keep local defaults if catalog call fails.
      }
    };

    void loadVoiceLanguages();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    const loadVoicePrompts = async () => {
      const res = await fetchPersonaPlexVoices({ force: true });
      if (cancelled || res?.error) return;
      const voices = Array.isArray(res?.voices) ? res.voices : [];
      setVoiceOptions(voices);
      if (!voicePromptId && voices[0]?.voicePromptId) {
        const next = setSelectedVoicePromptId(voices[0].voicePromptId);
        setVoicePromptId(next);
      }
    };

    void loadVoicePrompts();
    return () => {
      cancelled = true;
    };
  }, []);

  const enableMicrophone = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicReady(true);
      setAnswer('Microphone enabled. Tap Open Mic and start speaking.');
    } catch {
      setMicReady(false);
      setAnswer('Microphone permission was denied. Allow access and try again.');
    }
  };
  const stopAgentVoice = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const speakAnswer = async (text) => {
    if (!canUseSpeechOutput || !String(text || '').trim()) return;
    try {
      await speakCommentaryLines([{ speaker: 'Help Host', text, eventPayload: { voicePromptId, locale: selectedLocale } }], {
        voiceHints: { 'Help Host': [selectedLocale] },
        speakerSettings: { 'Help Host': 'personaplex' },
        channel: 'help'
      });
    } catch {
      setAnswer((prev) => `${prev}

(Voice unavailable right now. PersonaPlex synthesis did not return playable audio.)`);
    }
  };

  const runLocalFallback = async (text) => {
    const matches = searchLocalHelp(text, 5);
    const reply = buildStructuredResponse(text, matches, selectedLocale);
    setAnswer(reply.answer);
    setCitations(reply.citations);
    await speakAnswer(reply.answer);
  };

  const runAgentReply = async (text) => {
    if (isSensitiveHelpRequest(text)) {
      const blocked =
        'I can’t help with sensitive, private, or abuse-related requests. I can share public user guidance and official support steps.';
      setAnswer(blocked);
      setCitations([]);
      await speakAnswer(blocked);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/v1/user-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          locale: selectedLocale,
          mode: 'live-help-voice-only',
          systemContext:
            'You are TonPlaygram live help. Keep answers clear and voice-friendly. Reply in the selected locale.',
          capabilities: {
            interruptionAware: true,
            keepMicOpen: true,
            bargeIn: true,
            voiceOnly: true
          }
        })
      });

      if (!response.ok) {
        await runLocalFallback(text);
        return;
      }

      const payload = await response.json();
      const nextAnswer = String(payload?.answer || '').trim();
      const nextCitations = Array.isArray(payload?.citations) ? payload.citations : [];
      if (!nextAnswer) {
        await runLocalFallback(text);
        return;
      }

      setAnswer(nextAnswer);
      setCitations(nextCitations);
      await speakAnswer(nextAnswer);
    } catch {
      await runLocalFallback(text);
    } finally {
      setIsLoading(false);
    }
  };

  const stopVoiceInput = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  const startVoiceInput = () => {
    if (!canUseSpeechInput) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }

    if (!micReady) {
      setAnswer('Tap Enable Microphone first.');
      return;
    }

    stopAgentVoice();

    const recognition = createSpeechRecognition(selectedLocale);
    recognitionRef.current = recognition;
    if (!recognition) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = String(result?.[0]?.transcript || '').trim();
        if (!result.isFinal || !transcript) continue;
        stopAgentVoice();
        void runAgentReply(transcript);
      }
    };

    recognition.onerror = () => {
      setAnswer('Voice input failed. Please try again.');
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    setIsListening(true);
    recognition.start();
  };

  return (
    <section className="mt-4 bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">TonPlaygram AI Help Center</h3>
          <p className="text-xs text-subtext">Voice-only help • PersonaPlex voices • Tap a flag to change language</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md border border-border text-white"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-subtext">Supported languages</p>
        <div className="flex flex-wrap gap-2">
          {supportedLanguages.map((language) => (
            <button
              key={language.locale}
              type="button"
              onClick={() => setSelectedLocale(language.locale)}
              className={`h-10 w-10 rounded-lg border text-xl leading-none ${selectedLocale === language.locale ? 'border-primary bg-primary/20' : 'border-border'}`}
              aria-label={language.language}
              title={`${language.language} (${language.locale})`}
            >
              {LOCALE_TO_FLAG[language.locale] || '🌐'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60"
          onClick={enableMicrophone}
          disabled={isLoading}
        >
          {micReady ? '✅ Microphone Enabled' : '🎙 Enable Microphone'}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60"
          disabled={!canUseSpeechInput || isLoading || !micReady}
          onClick={isListening ? stopVoiceInput : startVoiceInput}
        >
          {isListening ? '⏹ Stop Mic' : '🎤 Open Mic'}
        </button>
        <select
          className="px-2 py-2 rounded-lg border border-border bg-surface text-xs text-white"
          value={voicePromptId}
          onChange={(event) => {
            const next = setSelectedVoicePromptId(event.target.value);
            setVoicePromptId(next);
          }}
        >
          <option value="">Default PersonaPlex voice</option>
          {voiceOptions.map((voice) => (
            <option key={voice.voicePromptId} value={voice.voicePromptId}>
              {voice.label || voice.voicePromptId}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-background/70 p-3">
        <p className="text-sm text-white whitespace-pre-line">{answer}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-subtext">Sources</p>
        {citations.length ? (
          <ul className="space-y-1">
            {citations.map((item) => (
              <li key={`${item.slug}-${item.sectionId}`} className="text-xs text-subtext">
                <a href={item.url} className="underline">
                  {item.title}
                </a>{' '}
                — {item.url}#{item.sectionId}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-subtext">No source selected yet.</p>
        )}
      </div>
    </section>
  );
}

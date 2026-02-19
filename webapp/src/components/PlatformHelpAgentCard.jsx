import { useMemo, useRef, useState } from 'react';
import { getSpeechSupport, speakCommentaryLines } from '../utils/textToSpeech.js';
import {
  buildStructuredResponse,
  isSensitiveHelpRequest,
  searchLocalHelp
} from '../utils/platformHelpLocalSearch.js';

const SPEECH_RECOGNITION_ERROR =
  'Voice input is unavailable on this device/browser. You can still type your question.';

const SUPPORTED_HELP_LANGUAGES = [
  { label: 'English', locale: 'en-US', flag: '🇺🇸' },
  { label: 'Shqip', locale: 'sq-AL', flag: '🇦🇱' },
  { label: 'Español', locale: 'es-ES', flag: '🇪🇸' },
  { label: 'Português', locale: 'pt-PT', flag: '🇵🇹' },
  { label: 'Türkçe', locale: 'tr-TR', flag: '🇹🇷' }
];

const PERSONAPLEX_HELP_SPEAKER = 'PersonaPlex Host';

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
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Hi! I can help with wallet, games, NFTs, matchmaking, roadmap, tasks, and troubleshooting. Pick your language and ask naturally.'
  );
  const [citations, setCitations] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('en-US');

  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');

  const canUseSpeechInput = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const canUseSpeechOutput = useMemo(() => Boolean(getSpeechSupport()), []);

  const stopAgentVoice = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const speakHelpAnswer = async (text) => {
    if (!isSpeakingEnabled || !canUseSpeechOutput) return;
    await speakCommentaryLines([{ speaker: PERSONAPLEX_HELP_SPEAKER, text }], {
      voiceHints: { [PERSONAPLEX_HELP_SPEAKER]: [selectedLocale] }
    });
  };

  const runLocalFallback = async (text) => {
    const matches = searchLocalHelp(text, 5);
    const reply = buildStructuredResponse(text, matches, selectedLocale);
    setAnswer(reply.answer);
    setCitations(reply.citations);
    await speakHelpAnswer(reply.answer);
  };

  const runAgentReply = async (text) => {
    if (isSensitiveHelpRequest(text)) {
      const blocked =
        'I can’t help with sensitive, private, or abuse-related requests. I can share public user guidance and official support steps.';
      setAnswer(blocked);
      setCitations([]);
      await speakHelpAnswer(blocked);
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
          mode: 'live-help',
          systemContext:
            'You are TonPlaygram live help. Be warm, concise, natural, and conversational. Ask follow-up questions. Avoid robotic responses. Reply in the user locale when possible.',
          capabilities: {
            interruptionAware: true,
            keepMicOpen: true,
            bargeIn: true
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
      await speakHelpAnswer(nextAnswer);
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

    stopAgentVoice();

    const recognition = createSpeechRecognition(selectedLocale);
    recognitionRef.current = recognition;
    if (!recognition) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }

    recognition.onresult = (event) => {
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript || '';
        if (result.isFinal) {
          const finalText = String(transcript || '').trim();
          if (!finalText) continue;
          liveTranscriptRef.current = '';
          setQuestion(finalText);
          stopAgentVoice();
          void runAgentReply(finalText);
        } else {
          partial += transcript;
        }
      }
      if (partial.trim()) {
        liveTranscriptRef.current = partial.trim();
        setQuestion(liveTranscriptRef.current);
      }
    };

    recognition.onerror = () => {
      setAnswer('Voice input failed. Please try again or type your question.');
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
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
          <p className="text-xs text-subtext">Voice-only help • PersonaPlex voice personalities • Public guidance only</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md border border-border text-white"
            onClick={() => setIsSpeakingEnabled((prev) => !prev)}
          >
            {isSpeakingEnabled ? 'Voice: ON' : 'Voice: OFF'}
          </button>
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
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-subtext">Choose help language (flag only)</p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_HELP_LANGUAGES.map((language) => (
            <button
              key={language.locale}
              type="button"
              onClick={() => setSelectedLocale(language.locale)}
              className={`px-2.5 py-1.5 rounded-lg border text-sm ${selectedLocale === language.locale ? 'border-primary bg-primary/20 text-white' : 'border-border text-subtext'}`}
              aria-label={`Help language ${language.label}`}
              title={language.label}
            >
              <span role="img" aria-label={language.label}>{language.flag}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-subtext">
        {question ? `🎤 ${question}` : 'Press Open Mic and ask your question. Voice input is required in Help mode.'}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60"
          disabled={!canUseSpeechInput || isLoading}
          onClick={isListening ? stopVoiceInput : startVoiceInput}
        >
          {isListening ? '⏹ Stop Mic' : '🎤 Open Mic'}
        </button>
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

import { useMemo, useRef, useState } from 'react';
import { getSpeechSupport, speakCommentaryLines } from '../utils/textToSpeech.js';
import {
  buildStructuredResponse,
  isSensitiveHelpRequest,
  searchLocalHelp
} from '../utils/platformHelpLocalSearch.js';

const SPEECH_RECOGNITION_ERROR =
  'Voice input is unavailable on this device/browser. You can still type your question.';

function createSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export default function PlatformHelpAgentCard() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Ask anything about TonPlaygram features, games, wallet, store, NFTs, roadmap, achievements, rules, and troubleshooting.'
  );
  const [citations, setCitations] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const recognitionRef = useRef(null);

  const canUseSpeechInput = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const canUseSpeechOutput = useMemo(() => Boolean(getSpeechSupport()), []);

  const runLocalFallback = async (text) => {
    const matches = searchLocalHelp(text, 3);
    const reply = buildStructuredResponse(text, matches);
    setAnswer(reply.answer);
    setCitations(reply.citations);
    if (isSpeakingEnabled && canUseSpeechOutput) {
      await speakCommentaryLines([{ speaker: 'Lena', text: reply.answer }]);
    }
  };

  const runAgentReply = async (text) => {
    if (isSensitiveHelpRequest(text)) {
      const blocked =
        'I can’t help with sensitive, private, or abuse-related requests. I can share public user guidance and official support steps.';
      setAnswer(blocked);
      setCitations([]);
      if (isSpeakingEnabled && canUseSpeechOutput) {
        await speakCommentaryLines([{ speaker: 'Lena', text: blocked }]);
      }
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/v1/user-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
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
      if (isSpeakingEnabled && canUseSpeechOutput) {
        await speakCommentaryLines([{ speaker: 'Lena', text: nextAnswer }]);
      }
    } catch {
      await runLocalFallback(text);
    } finally {
      setIsLoading(false);
    }
  };

  const askQuestion = async () => {
    const text = question.trim();
    if (!text) return;
    await runAgentReply(text);
  };

  const startVoiceInput = () => {
    if (!canUseSpeechInput) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = createSpeechRecognition();
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setAnswer(SPEECH_RECOGNITION_ERROR);
      return;
    }

    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setQuestion(text);
      void runAgentReply(text);
    };

    recognition.onerror = () => {
      setAnswer('Voice input failed. Please try again or type your question.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  };

  return (
    <section className="mt-4 bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">TonPlaygram Live Help Agent</h3>
          <p className="text-xs text-subtext">Public-only guidance • Live knowledge index • Voice + text replies</p>
        </div>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded-md border border-border text-white"
          onClick={() => setIsSpeakingEnabled((prev) => !prev)}
        >
          {isSpeakingEnabled ? 'Voice: ON' : 'Voice: OFF'}
        </button>
      </div>

      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={3}
        className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-white"
        placeholder="Ask anything: full platform intro, games, rules, roadmap, wallet, store, NFTs, or troubleshooting..."
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-60"
          onClick={() => void askQuestion()}
          disabled={isLoading}
        >
          {isLoading ? 'Thinking…' : 'Ask'}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60"
          disabled={!canUseSpeechInput || isListening || isLoading}
          onClick={startVoiceInput}
        >
          {isListening ? 'Listening…' : '🎤 Speak'}
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

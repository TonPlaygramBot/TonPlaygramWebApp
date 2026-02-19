import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Citation {
  title: string;
  slug: string;
  sectionId: string;
  url: string;
}

interface ChatReply {
  answer: string;
  language?: string;
  citations: Citation[];
}

interface HelpLanguage {
  locale: string;
  language: string;
  voiceId: string;
  flag: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal: boolean;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const DEFAULT_LANGUAGES: HelpLanguage[] = [
  { locale: 'en-US', language: 'English', voiceId: 'nova_en_us_f', flag: '🇺🇸' },
  { locale: 'sq-AL', language: 'Albanian', voiceId: 'anisa_sq_al_f', flag: '🇦🇱' },
  { locale: 'es-ES', language: 'Spanish', voiceId: 'luna_es_es_f', flag: '🇪🇸' }
];

export function HelpWidget({ apiBaseUrl }: { apiBaseUrl: string }): JSX.Element {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [languages, setLanguages] = useState<HelpLanguage[]>(DEFAULT_LANGUAGES);
  const [selectedLocale, setSelectedLocale] = useState(DEFAULT_LANGUAGES[0].locale);
  const [micLive, setMicLive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);

  const disabled = useMemo(() => loading || !message.trim(), [loading, message]);
  const selectedLanguage = useMemo(
    () => languages.find((item) => item.locale === selectedLocale) ?? languages[0],
    [languages, selectedLocale]
  );

  useEffect(() => {
    void fetch(`${apiBaseUrl}/v1/help/languages`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { items?: HelpLanguage[] };
        if (Array.isArray(data.items) && data.items.length) {
          setLanguages(data.items);
          setSelectedLocale((prev) => (data.items?.some((item) => item.locale === prev) ? prev : data.items[0].locale));
        }
      })
      .catch(() => {});
  }, [apiBaseUrl]);

  async function send(textOverride?: string): Promise<void> {
    const outbound = (textOverride ?? message).trim();
    if (!outbound) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/v1/user-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: outbound, locale: selectedLocale })
      });
      const data = (await res.json()) as ChatReply;
      setReply(data);
      speakAnswer(data.answer);
      if (!textOverride) setMessage('');
    } finally {
      setLoading(false);
    }
  }

  function speakAnswer(text: string): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLocale;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const source = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    return source.SpeechRecognition ?? source.webkitSpeechRecognition ?? null;
  }

  function startVoiceMode(): void {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceError('Live voice is not supported in this browser.');
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new Recognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const spoken = (result?.[0]?.transcript || '').trim();
        if (!spoken) return;

        setMessage(spoken);

        if (result?.isFinal) {
          if (window.speechSynthesis?.speaking) {
            window.speechSynthesis.cancel();
          }
          void send(spoken);
        }
      };

      recognitionRef.current.onerror = (event) => {
        setVoiceError(event.error ?? 'Microphone error');
      };

      recognitionRef.current.onend = () => {
        if (shouldKeepListeningRef.current) {
          recognitionRef.current?.start();
        }
      };
    }

    shouldKeepListeningRef.current = true;
    recognitionRef.current.lang = selectedLocale;
    recognitionRef.current.start();
    setMicLive(true);
    setVoiceError(null);
  }

  function stopVoiceMode(): void {
    shouldKeepListeningRef.current = false;
    recognitionRef.current?.stop();
    setMicLive(false);
  }

  return (
    <div style={{ maxWidth: 420, border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
      <h3>AI Help Center</h3>
      <p>Choose your language, then ask by text or voice. You can interrupt while the assistant is speaking.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {languages.map((item) => (
          <button
            key={item.locale}
            onClick={() => setSelectedLocale(item.locale)}
            style={{
              borderRadius: 999,
              border: item.locale === selectedLocale ? '2px solid #1a73e8' : '1px solid #bbb',
              padding: '4px 10px',
              background: '#fff',
              cursor: 'pointer'
            }}
            aria-label={`Switch language to ${item.language}`}
            title={`${item.language} (${item.locale})`}
          >
            <span style={{ marginRight: 6 }}>{item.flag}</span>
            {item.language}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{ width: '100%', marginBottom: 8 }}
        placeholder={`Ask in ${selectedLanguage?.language ?? 'your language'}...`}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={disabled} onClick={() => void send()}>
          {loading ? 'Loading...' : 'Ask AI Help'}
        </button>
        {!micLive ? (
          <button onClick={startVoiceMode}>Start live mic</button>
        ) : (
          <button onClick={stopVoiceMode}>Stop mic</button>
        )}
      </div>

      {voiceError ? <p style={{ color: '#b00020', marginTop: 8 }}>{voiceError}</p> : null}

      {reply ? (
        <div style={{ marginTop: 12 }}>
          <strong>Answer ({reply.language ?? selectedLanguage?.language ?? 'English'})</strong>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{reply.answer}</pre>
          <strong>Sources</strong>
          <ul>
            {reply.citations.map((cite) => (
              <li key={`${cite.slug}-${cite.sectionId}`}>
                {cite.title} — {cite.url}#{cite.sectionId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

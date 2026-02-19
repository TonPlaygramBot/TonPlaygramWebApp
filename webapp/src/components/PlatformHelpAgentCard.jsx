import { useEffect, useMemo, useRef, useState } from 'react';
import { get, postMultipart } from '../utils/api.js';

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

export default function PlatformHelpAgentCard({ onClose = null }) {
  const [answer, setAnswer] = useState('Enable microphone, hold Start, then Stop to ask for help.');
  const [status, setStatus] = useState('Idle');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const [supportedLanguages, setSupportedLanguages] = useState(DEFAULT_LANGUAGES);
  const [audioSrc, setAudioSrc] = useState('');
  const [sessionId] = useState(() => `help_${crypto.randomUUID()}`);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const canUseSpeechInput = useMemo(() => Boolean(navigator?.mediaDevices?.getUserMedia), []);

  useEffect(() => {
    let cancelled = false;
    const loadVoiceLanguages = async () => {
      const payload = await get('/v1/voices');
      const voices = Array.isArray(payload?.voices) ? payload.voices : [];
      if (!voices.length || cancelled) return;
      const unique = new Map();
      voices.forEach((voice) => {
        const locale = String(voice?.locale || '').trim();
        const language = String(voice?.label || voice?.language || '').trim();
        if (!locale || !language || unique.has(locale)) return;
        unique.set(locale, { locale, language });
      });
      const items = Array.from(unique.values());
      if (items.length) setSupportedLanguages(items);
    };
    void loadVoiceLanguages();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  const enableMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatus('Microphone enabled');
    } catch (error) {
      setStatus(`Mic permission failed: ${String(error)}`);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setStatus('Enable microphone first');
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstart = () => setStatus('Recording support request...');
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await sendSupportVoice(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const sendSupportVoice = async (blob) => {
    setIsLoading(true);
    setStatus('Sending to help center...');
    const form = new FormData();
    form.append('audio', blob, 'support.webm');
    form.append('sessionId', sessionId);
    form.append('voicePromptId', selectedLocale);

    const payload = await postMultipart('/v1/support/voice', form);
    if (payload?.error) {
      setStatus(payload.error);
      setIsLoading(false);
      return;
    }

    const text = String(payload?.text || '').trim();
    setAnswer(text || 'No answer returned.');
    const source = payload?.audioUrl || (payload?.audioBase64 ? `data:audio/wav;base64,${payload.audioBase64}` : '');
    setAudioSrc(source);
    setStatus('Support response ready');
    setIsLoading(false);
  };

  return (
    <section className="mt-4 bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">TonPlaygram AI Help Center</h3>
          <p className="text-xs text-subtext">Voice help powered by PersonaPlex</p>
        </div>
        {onClose ? (
          <button type="button" className="px-2 py-1 text-xs rounded-md border border-border text-white" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-subtext">Language</p>
        <div className="flex flex-wrap gap-2">
          {supportedLanguages.map((language) => (
            <button
              key={language.locale}
              type="button"
              onClick={() => setSelectedLocale(language.locale)}
              className={`h-10 w-10 rounded-lg border text-xl leading-none ${selectedLocale === language.locale ? 'border-primary bg-primary/20' : 'border-border'}`}
              aria-label={language.language}
            >
              {LOCALE_TO_FLAG[language.locale] || '🌐'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="px-3 py-2 rounded-lg border border-border text-sm text-white" disabled={!canUseSpeechInput} onClick={enableMicrophone}>🎙 Enable Microphone</button>
        <button type="button" className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60" disabled={isLoading || !canUseSpeechInput} onClick={startRecording}>Start</button>
        <button type="button" className="px-3 py-2 rounded-lg border border-border text-sm text-white disabled:opacity-60" disabled={isLoading} onClick={stopRecording}>Stop & Send</button>
      </div>

      <p className="text-xs text-subtext">Status: {status}</p>
      <div className="rounded-lg border border-border bg-background/70 p-3">
        <p className="text-sm text-white whitespace-pre-line">{answer}</p>
      </div>
      {audioSrc ? <audio controls src={audioSrc} className="w-full" /> : null}
    </section>
  );
}

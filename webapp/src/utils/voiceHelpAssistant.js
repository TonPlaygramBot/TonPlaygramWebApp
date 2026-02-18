import { post } from './api.js';
import { primeSpeechSynthesis } from './textToSpeech.js';
import { speakWithVoiceProvider } from '../voice/voiceProviderFactory.ts';
import { PERSONA_DEFAULTS } from '../voice/voiceConfig.ts';

const SPEECH_RECOGNITION =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

async function playSynthesis(payload, locale = 'en-US') {
  primeSpeechSynthesis();
  const fallbackText = payload?.answer || payload?.text || '';
  if (!fallbackText) return;

  await speakWithVoiceProvider(fallbackText, {
    context: 'help',
    voiceId: payload?.voice?.id || PERSONA_DEFAULTS.help.voiceId,
    persona: PERSONA_DEFAULTS.help.persona,
    hints: [locale]
  });
}

function listenOnce(locale = 'en-US', timeoutMs = 9000) {
  if (!SPEECH_RECOGNITION) return Promise.resolve('');
  return new Promise((resolve) => {
    const recognition = new SPEECH_RECOGNITION();
    recognition.lang = locale || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    let done = false;
    const finish = (value = '') => {
      if (done) return;
      done = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      resolve(value);
    };
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      finish(String(transcript || '').trim());
    };
    recognition.onerror = () => finish('');
    recognition.onend = () => finish('');
    recognition.start();
    setTimeout(() => finish(''), timeoutMs);
  });
}

export async function runVoiceHelpSession({ accountId, locale = 'en-US' }) {
  const first = await post('/api/voice-commentary/help', { accountId, locale, question: '' });
  if (first?.error) throw new Error(first.error);
  await playSynthesis(first, locale);

  const spokenQuestion = await listenOnce(locale);
  const answer = await post('/api/voice-commentary/help', {
    accountId,
    locale,
    question: spokenQuestion || 'general app help'
  });
  if (answer?.error) throw new Error(answer.error);
  await playSynthesis(answer, locale);
  return { question: spokenQuestion, answer: answer.answer || '' };
}

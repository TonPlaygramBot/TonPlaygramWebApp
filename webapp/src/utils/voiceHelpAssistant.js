import { post } from './api.js';
import { primeSpeechSynthesis } from './textToSpeech.js';
import { speakWithVoiceProvider } from '../voice/voiceProviderFactory.ts';
import { PERSONA_DEFAULTS } from '../voice/voiceConfig.ts';
import { buildStructuredResponse, searchLocalHelp } from './platformHelpLocalSearch.js';

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



function buildLocalPayload(question = 'general app help') {
  const matches = searchLocalHelp(question, 3);
  const reply = buildStructuredResponse(question, matches);
  return { answer: reply.answer, citations: reply.citations };
}

async function safeHelpApi(accountId, locale, question) {
  try {
    const payload = await post('/api/voice-commentary/help', { accountId, locale, question });
    if (payload?.error) return null;
    return payload;
  } catch {
    return null;
  }
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
  const welcome =
    (await safeHelpApi(accountId, locale, '')) ||
    { answer: 'Hi! I am TonPlaygram voice help. Ask me anything about games, wallets, rewards, matchmaking, or troubleshooting.' };
  await playSynthesis(welcome, locale);

  const spokenQuestion = await listenOnce(locale);
  const resolvedQuestion = spokenQuestion || 'general app help';
  const answer = (await safeHelpApi(accountId, locale, resolvedQuestion)) || buildLocalPayload(resolvedQuestion);
  await playSynthesis(answer, locale);
  return { question: spokenQuestion, answer: answer.answer || '' };
}

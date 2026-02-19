import { post } from './api.js';
import { primeSpeechSynthesis } from './textToSpeech.js';

const SPEECH_RECOGNITION =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

function speakWithWebSpeech(text, locale = 'en-US') {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim());
    utterance.lang = locale || 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playSynthesis(payload, locale = 'en-US') {
  primeSpeechSynthesis();
  const synthesis = payload?.synthesis || {};
  const fallbackText = payload?.answer || payload?.text || '';
  const source = synthesis.audioUrl || (synthesis.audioBase64 ? `data:${synthesis.mimeType || 'audio/mpeg'};base64,${synthesis.audioBase64}` : '');
  if (!source) {
    await speakWithWebSpeech(fallbackText, locale);
    return;
  }
  const audio = new Audio(source);
  const playbackResult = await new Promise((resolve) => {
    const finish = () => {
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', fail);
      resolve(true);
    };
    const fail = () => {
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', fail);
      resolve(false);
    };
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', fail);
    audio.play().catch(fail);
  });

  if (!playbackResult && fallbackText) {
    await speakWithWebSpeech(fallbackText, locale);
    return;
  }

  if (payload?.provider === 'web-speech-fallback' && fallbackText) {
    await speakWithWebSpeech(fallbackText, locale);
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

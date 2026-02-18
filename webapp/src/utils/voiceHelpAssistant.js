import { post } from './api.js'
import { primeSpeechSynthesis } from './textToSpeech.js'

const SPEECH_RECOGNITION =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null

const HELP_GREETING = 'Hello, I am TonPlaygram voice help. How can I help you today?'

const buildSynthesisSource = (payload) => {
  const synthesis = payload?.synthesis || {}
  return (
    synthesis.audioUrl ||
    (synthesis.audioBase64
      ? `data:${synthesis.mimeType || 'audio/mpeg'};base64,${synthesis.audioBase64}`
      : '')
  )
}

async function playBrowserSpeech (text, locale = 'en-US') {
  if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') {
    return
  }

  await new Promise((resolve, reject) => {
    try {
      const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim())
      utterance.lang = locale || 'en-US'
      utterance.onend = () => resolve()
      utterance.onerror = () => reject(new Error('Help speech synthesis failed'))
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch {
      reject(new Error('Help speech synthesis failed'))
    }
  })
}

async function playSynthesis (payload) {
  primeSpeechSynthesis()
  const source = buildSynthesisSource(payload)
  if (!source) throw new Error('Missing help audio')
  const audio = new Audio(source)
  await new Promise((resolve, reject) => {
    const finish = () => {
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', fail)
      reject(new Error('Help audio playback failed'))
    }
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', fail)
    audio.play().catch(async (error) => {
      if (error?.name === 'NotAllowedError') {
        primeSpeechSynthesis()
        audio.play().catch(fail)
        return
      }
      fail()
    })
  })
}

function listenOnce (locale = 'en-US', timeoutMs = 9000) {
  if (!SPEECH_RECOGNITION) return Promise.resolve('')
  return new Promise((resolve) => {
    const recognition = new SPEECH_RECOGNITION()
    recognition.lang = locale || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    let done = false
    const finish = (value = '') => {
      if (done) return
      done = true
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      resolve(value)
    }
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || ''
      finish(String(transcript || '').trim())
    }
    recognition.onerror = () => finish('')
    recognition.onend = () => finish('')
    recognition.start()
    setTimeout(() => finish(''), timeoutMs)
  })
}

export async function runVoiceHelpSession ({ accountId, locale = 'en-US' }) {
  const first = await post('/api/voice-commentary/help', { accountId, locale, question: '' })
  if (first?.error) throw new Error(first.error)
  try {
    await playSynthesis(first)
  } catch {
    await playBrowserSpeech(first?.answer || HELP_GREETING, locale)
  }

  const spokenQuestion = await listenOnce(locale)
  const answer = await post('/api/voice-commentary/help', {
    accountId,
    locale,
    question: spokenQuestion || 'general app help'
  })
  if (answer?.error) throw new Error(answer.error)
  try {
    await playSynthesis(answer)
  } catch {
    await playBrowserSpeech(answer?.answer || 'I can help with wallet, games, store purchases, voice commentary, and account setup.', locale)
  }
  return { question: spokenQuestion, answer: answer.answer || '' }
}

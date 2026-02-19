import { get, post } from './api.js'

let commentarySupport = true
const listeners = new Set()
let audioUnlocked = false
let unlockPromise = null
let voicesCache = null

const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const TINY_SILENCE_MP3 =
  'data:audio/mpeg;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjE1LjEwNAAAAAAAAAAAAAAA//tQxAADBzQASQAAABhAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP/7UMQAAwcoAEkAAABoAAAACAAADSAAAAAEAAANIAAAAAExhdmM1Ni4xNAAAAAAAAAAAAAAAACQCkAAAAAAAAAAAAAAAAAAAA//sQxAADAgAASAAAABgAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg'

const VOICE_PROMPT_STORAGE_KEY = 'tpg.personaplex.voicePromptId'
const VOICE_SESSION_STORAGE_KEY = 'tpg.personaplex.sessionId'

const emitSupport = (supported) => {
  if (commentarySupport === supported) return
  commentarySupport = supported
  listeners.forEach((listener) => {
    try {
      listener(supported)
    } catch {
      // no-op
    }
  })
}

const getSessionId = () => {
  if (typeof window === 'undefined') return 'guest-session'
  const existing = window.localStorage.getItem(VOICE_SESSION_STORAGE_KEY)
  if (existing) return existing
  const next = window.crypto?.randomUUID?.() || `session-${Date.now()}`
  window.localStorage.setItem(VOICE_SESSION_STORAGE_KEY, next)
  return next
}

export const getSelectedVoicePromptId = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(VOICE_PROMPT_STORAGE_KEY) || ''
}

export const setSelectedVoicePromptId = (voicePromptId) => {
  if (typeof window === 'undefined') return ''
  const value = String(voicePromptId || '').trim()
  window.localStorage.setItem(VOICE_PROMPT_STORAGE_KEY, value)
  return value
}

export const fetchPersonaPlexVoices = async ({ force = false } = {}) => {
  if (!force && voicesCache) return voicesCache
  const res = await get('/v1/voices')
  if (res?.error) return { voices: [], error: res.error }
  const voices = Array.isArray(res?.voices) ? res.voices : []
  voicesCache = { voices }
  return voicesCache
}

const getCurrentAccountId = () => {
  if (typeof window === 'undefined') return 'guest'
  return window.localStorage.getItem('accountId') || 'guest'
}

const unlockAudioPlayback = async () => {
  if (audioUnlocked || typeof window === 'undefined') return
  if (!unlockPromise) {
    unlockPromise = (async () => {
      try {
        const audio = new Audio(TINY_SILENCE_MP3)
        audio.muted = true
        audio.volume = 0
        audio.currentTime = 0
        const playPromise = audio.play()
        if (playPromise?.then) await playPromise
        audio.pause()
        audio.currentTime = 0
        audioUnlocked = true
      } catch {
        audioUnlocked = false
      } finally {
        unlockPromise = null
      }
    })()
  }
  await unlockPromise
}

const playFromSource = async (source) => {
  await unlockAudioPlayback()
  const audio = new Audio(source)
  await new Promise((resolve, reject) => {
    const onDone = () => {
      audio.removeEventListener('ended', onDone)
      audio.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      audio.removeEventListener('ended', onDone)
      audio.removeEventListener('error', onError)
      reject(new Error('Audio playback failed'))
    }
    audio.addEventListener('ended', onDone)
    audio.addEventListener('error', onError)
    audio.play().catch(async (error) => {
      if ((error && error.name === 'NotAllowedError') || !audioUnlocked) {
        await unlockAudioPlayback()
        audio.play().catch(onError)
        return
      }
      onError()
    })
  })
}

const playAudioPayload = async (payload) => {
  const synthesis = payload?.synthesis || payload || {}
  const audioUrl = synthesis.audioUrl || ''
  const audioBase64 = synthesis.audioBase64 || ''
  const mimeType = synthesis.mimeType || 'audio/wav'
  if (!audioUrl && !audioBase64) {
    throw new Error('PersonaPlex response missing audio payload')
  }
  const source = audioUrl || `data:${mimeType};base64,${audioBase64}`
  await playFromSource(source)
}

export const installSpeechSynthesisUnlock = () => {
  if (typeof window === 'undefined') return
  const onUserGesture = () => {
    if (!audioUnlocked) {
      unlockAudioPlayback().catch(() => {})
    }
  }
  UNLOCK_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onUserGesture, { passive: true })
  })
}

export const getSpeechSynthesis = () => null

export const getSpeechSupport = () =>
  commentarySupport &&
  typeof window !== 'undefined' &&
  (typeof window.Audio !== 'undefined' ||
    (typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'))

export const onSpeechSupportChange = (callback) => {
  if (typeof callback !== 'function') return () => {}
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export const primeSpeechSynthesis = () => {
  unlockAudioPlayback().catch(() => {})
}

export const resolveVoiceForSpeaker = () => null

const speakWithBrowserTts = async (text) => {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    !window.SpeechSynthesisUtterance ||
    !String(text || '').trim()
  ) {
    throw new Error('Web Speech is unavailable')
  }

  await unlockAudioPlayback()

  await new Promise((resolve, reject) => {
    const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim())
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = () => resolve()
    utterance.onerror = () => reject(new Error('Web Speech playback failed'))

    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch {
      reject(new Error('Web Speech playback failed'))
    }
  })
}

async function requestSpeechFromApi({ text, speaker, channel, locale, eventType, eventPayload }) {
  const voicePromptId = getSelectedVoicePromptId() || undefined
  const sessionId = getSessionId()

  if (channel === 'help') {
    const res = await post('/v1/support/text', {
      messages: [{ role: 'user', content: text }],
      sessionId,
      voicePromptId
    })
    return res
  }

  const commentaryRes = await post('/v1/commentary/event', {
    eventType: eventType || 'GAME_EVENT',
    eventPayload: {
      speaker,
      text,
      locale,
      ...(eventPayload && typeof eventPayload === 'object' ? eventPayload : {})
    },
    sessionId,
    voicePromptId
  })
  return commentaryRes
}

export const speakCommentaryLines = async (
  lines,
  { voiceHints = {}, speakerSettings = {}, channel = 'commentary', allowBrowserFallback = false } = {}
) => {
  if (!Array.isArray(lines) || !lines.length || typeof window === 'undefined') return

  getCurrentAccountId()

  for (const line of lines) {
    const text = String(line?.text || '').trim()
    if (!text) continue

    const speaker = line?.speaker || 'Host'
    const hints = Array.isArray(voiceHints[speaker]) ? voiceHints[speaker] : []
    const localeHint = line?.locale || hints.find((hint) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(hint || '')))

    const payload = await requestSpeechFromApi({
      text,
      speaker,
      channel,
      locale: localeHint,
      style: speakerSettings[speaker] || null,
      eventType: line?.eventType,
      eventPayload: line?.eventPayload
    })

    if (payload?.error) {
      emitSupport(false)
      throw new Error(payload.error)
    }

    try {
      if (!payload?.audioUrl && !payload?.audioBase64) {
        if (!allowBrowserFallback) {
          throw new Error('PersonaPlex audio payload missing')
        }
        await speakWithBrowserTts(payload?.text || text)
      } else {
        try {
          await playAudioPayload(payload)
        } catch {
          if (!allowBrowserFallback) throw new Error('PersonaPlex audio playback failed')
          await speakWithBrowserTts(payload?.text || text)
        }
      }
      emitSupport(true)
    } catch (error) {
      emitSupport(false)
      throw error
    }
  }
}

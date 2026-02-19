import { post } from './api.js'

let commentarySupport = true
const listeners = new Set()
let audioUnlocked = false
let unlockPromise = null

const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const TINY_SILENCE_MP3 =
  'data:audio/mpeg;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjE1LjEwNAAAAAAAAAAAAAAA//tQxAADBzQASQAAABhAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP/7UMQAAwcoAEkAAABoAAAACAAADSAAAAAEAAANIAAAAAExhdmM1Ni4xNAAAAAAAAAAAAAAAACQCkAAAAAAAAAAAAAAAAAAAA//sQxAADAgAASAAAABgAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg'


const PERSONAPLEX_PERSONALITY_BY_SPEAKER = {
  host: 'play_by_play-host',
  commentator: 'play_by_play-host',
  analyst: 'match-analyst',
  lena: 'helpful-guide',
  tabletennishost: 'play_by_play-host'
}

const resolvePersonaPlexPersonality = (speaker = '', speakerStyle = null) => {
  if (speakerStyle && typeof speakerStyle === 'object' && speakerStyle.personality) {
    return String(speakerStyle.personality)
  }
  if (typeof speakerStyle === 'string' && speakerStyle.trim()) {
    return speakerStyle.trim()
  }
  const key = String(speaker || '').toLowerCase().replace(/\s+/g, '')
  return PERSONAPLEX_PERSONALITY_BY_SPEAKER[key] || 'play_by_play-host'
}

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

const playAudioPayload = async (payload) => {
  const synthesis = payload?.synthesis || {}
  const audioUrl = synthesis.audioUrl
  const audioBase64 = synthesis.audioBase64
  const mimeType = synthesis.mimeType || 'audio/mpeg'
  if (!audioUrl && !audioBase64) {
    throw new Error('PersonaPlex response missing audio payload')
  }

  await unlockAudioPlayback()

  const source = audioUrl || `data:${mimeType};base64,${audioBase64}`
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

const pickSpeechSynthesisVoice = (hints = []) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices?.() || []
  if (!voices.length) return null

  const normalizedHints = hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean)
  for (const hint of normalizedHints) {
    const byLang = voices.find((voice) => String(voice.lang || '').toLowerCase() === hint)
    if (byLang) return byLang
    const byPrefix = voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(`${hint}-`))
    if (byPrefix) return byPrefix
    const byName = voices.find((voice) => String(voice.name || '').toLowerCase().includes(hint))
    if (byName) return byName
  }

  return voices.find((voice) => voice.default) || voices[0]
}

const speakWithBrowserTts = async (text, hints = []) => {
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
    const preferredVoice = pickSpeechSynthesisVoice(hints)
    if (preferredVoice) {
      utterance.voice = preferredVoice
      if (preferredVoice.lang) utterance.lang = preferredVoice.lang
    }

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

export const speakCommentaryLines = async (
  lines,
  { voiceHints = {}, speakerSettings = {} } = {}
) => {
  if (!Array.isArray(lines) || !lines.length || typeof window === 'undefined') return

  const accountId = getCurrentAccountId()

  for (const line of lines) {
    const text = String(line?.text || '').trim()
    if (!text) continue

    const speaker = line?.speaker || 'Host'
    const hints = Array.isArray(voiceHints[speaker]) ? voiceHints[speaker] : []
    const localeHint = hints.find((hint) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(hint || '')))

    const speakerStyle = speakerSettings[speaker] || null
    const payload = await post('/api/voice-commentary/speak', {
      accountId,
      text,
      speaker,
      locale: localeHint,
      style: speakerStyle,
      personality: resolvePersonaPlexPersonality(speaker, speakerStyle)
    })

    if (payload?.error) {
      emitSupport(false)
      throw new Error(payload.error)
    }

    try {
      if (payload?.provider === 'web-speech-fallback' || !payload?.synthesis?.audioUrl && !payload?.synthesis?.audioBase64) {
        await speakWithBrowserTts(payload?.text || text, hints)
      } else {
        try {
          await playAudioPayload(payload)
        } catch {
          await speakWithBrowserTts(payload?.text || text, hints)
        }
      }
      emitSupport(true)
    } catch (error) {
      emitSupport(false)
      throw error
    }
  }
}

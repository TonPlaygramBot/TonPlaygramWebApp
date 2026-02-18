import { post } from './api.js'

let commentarySupport = true
const listeners = new Set()
let audioUnlocked = false
let unlockPromise = null

const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const TINY_SILENCE_MP3 =
  'data:audio/mpeg;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjE1LjEwNAAAAAAAAAAAAAAA//tQxAADBzQASQAAABhAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP/7UMQAAwcoAEkAAABoAAAACAAADSAAAAAEAAANIAAAAAExhdmM1Ni4xNAAAAAAAAAAAAAAAACQCkAAAAAAAAAAAAAAAAAAAA//sQxAADAgAASAAAABgAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg'

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
  commentarySupport && typeof window !== 'undefined' && typeof window.Audio !== 'undefined'

export const onSpeechSupportChange = (callback) => {
  if (typeof callback !== 'function') return () => {}
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export const primeSpeechSynthesis = () => {
  unlockAudioPlayback().catch(() => {})
}

export const resolveVoiceForSpeaker = () => null

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

    const payload = await post('/api/voice-commentary/speak', {
      accountId,
      text,
      speaker,
      locale: localeHint,
      style: speakerSettings[speaker] || null
    })

    if (payload?.error) {
      emitSupport(false)
      throw new Error(payload.error)
    }

    emitSupport(true)
    await playAudioPayload(payload)
  }
}

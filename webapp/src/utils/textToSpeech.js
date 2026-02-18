import { speakWithVoiceProvider, stopVoicePlayback } from '../voice/voiceProviderFactory.ts'

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

export const getSpeechSynthesis = () =>
  typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null

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

export const speakCommentaryLines = async (
  lines,
  { voiceHints = {}, speakerSettings = {}, context = 'commentary', gameId } = {}
) => {
  if (!Array.isArray(lines) || !lines.length || typeof window === 'undefined') return

  for (const line of lines) {
    const text = String(line?.text || '').trim()
    if (!text) continue

    const speaker = line?.speaker || 'Host'
    const hints = Array.isArray(voiceHints[speaker]) ? voiceHints[speaker] : []

    try {
      await speakWithVoiceProvider(text, {
        context,
        gameId,
        persona: speakerSettings[speaker] || undefined,
        hints
      })
      emitSupport(true)
    } catch (error) {
      emitSupport(false)
      throw error
    }
  }
}

export const cancelSpeechQueue = () => {
  stopVoicePlayback()
}

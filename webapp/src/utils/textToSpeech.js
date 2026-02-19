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

const inferGameKeyFromRoute = () => {
  if (typeof window === 'undefined') return 'snake_and_ladder'
  const path = window.location.pathname
  if (path.includes('/games/poolroyale')) return 'pool_royale'
  if (path.includes('/games/snookerroyale')) return 'snooker_royal'
  if (path.includes('/games/texasholdem')) return 'texas_holdem'
  if (path.includes('/games/domino-royal')) return 'domino_royal'
  if (path.includes('/games/chessbattleroyal')) return 'chess_battle_royal'
  if (path.includes('/games/airhockey')) return 'air_hockey'
  if (path.includes('/games/goalrush')) return 'goal_rush'
  if (path.includes('/games/ludobattleroyal')) return 'ludo_battle_royal'
  if (path.includes('/games/tabletennisroyal')) return 'table_tennis_royal'
  if (path.includes('/games/murlanroyale')) return 'murlan_royale'
  if (path.includes('/games/snake')) return 'snake_and_ladder'
  return 'snake_and_ladder'
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
  const synthesis = payload?.synthesis || payload || {}
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
  }
  return voices.find((voice) => voice.default) || voices[0]
}

const speakWithBrowserTts = async (text, hints = []) => {
  if (!String(text || '').trim() || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    throw new Error('Web Speech unavailable')
  }
  await unlockAudioPlayback()
  await new Promise((resolve, reject) => {
    const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim())
    const preferredVoice = pickSpeechSynthesisVoice(hints)
    if (preferredVoice) utterance.voice = preferredVoice
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

export const getSpeechSynthesis = () => {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis || { cancel: () => {} }
}

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
  { voiceHints = {}, speakerSettings = {}, channel = 'commentary', allowBrowserFallback = true } = {}
) => {
  if (!Array.isArray(lines) || !lines.length || typeof window === 'undefined') return

  const accountId = getCurrentAccountId()
  const gameKey = inferGameKeyFromRoute()

  for (const line of lines) {
    const text = String(line?.text || '').trim()
    if (!text) continue

    const speaker = line?.speaker || 'Host'
    const hints = Array.isArray(voiceHints[speaker]) ? voiceHints[speaker] : []

    const payload = await post('/v1/commentary/event', {
      sessionId: accountId,
      eventType: 'line',
      eventPayload: {
        gameKey,
        speaker,
        text,
        channel,
        voiceHints: hints,
        style: speakerSettings[speaker] || null
      }
    })

    if (payload?.error) {
      emitSupport(false)
      throw new Error(payload.error)
    }

    try {
      if (!payload?.audioUrl && !payload?.audioBase64 && !payload?.synthesis?.audioUrl && !payload?.synthesis?.audioBase64) {
        if (!allowBrowserFallback) throw new Error('PersonaPlex audio missing')
        await speakWithBrowserTts(payload?.text || text, hints)
      } else {
        await playAudioPayload(payload)
      }
      emitSupport(true)
    } catch (error) {
      if (!allowBrowserFallback) {
        emitSupport(false)
        throw error
      }
      await speakWithBrowserTts(payload?.text || text, hints)
      emitSupport(true)
    }
  }
}

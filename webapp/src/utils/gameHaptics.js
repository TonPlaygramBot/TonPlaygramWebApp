const HAPTIC_PATTERNS = Object.freeze({
  press: 10,
  diceLand: [18, 28, 32],
  ladder: [12, 28, 12, 28, 36],
  snake: [45, 35, 70],
  capture: [25, 30, 55],
  win: [35, 45, 35, 45, 90]
})

/**
 * Plays optional tactile feedback without making gameplay depend on browser
 * vibration support. Browsers that do not expose the API simply return false.
 */
export function playGameHaptic (kind) {
  const pattern = HAPTIC_PATTERNS[kind]
  if (pattern == null || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }

  return navigator.vibrate(pattern)
}

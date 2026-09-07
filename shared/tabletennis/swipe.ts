// Both racket games measure the last 120 ms of finger motion; holding does not charge.
export {
  beginSwipe,
  sampleSwipe,
  readSwipe,
  TAP_POWER
} from '../tennis/swipe.js';
export type { Swipe as SwipeGesture } from '../tennis/swipe.js';

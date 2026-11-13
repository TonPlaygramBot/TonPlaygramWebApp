import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TURI_MODEL_URL } from '../../config/playerCharacter.js';
import type { Seat } from './engine';

// The local player always uses the same authored Turi as Tirana Streets.
// Keep the existing opponent athlete, including when online assigns seat 1.
export const athleteUrl = (seat: Seat, localSeat: Seat = 0) =>
  seat === localSeat
    ? TURI_MODEL_URL
    : `/assets/table-tennis/athlete-${seat === 0 ? 'male' : 'female'}.glb`;
export const loadAthlete = (seat: Seat, localSeat: Seat = 0) =>
  new GLTFLoader()
    .loadAsync(athleteUrl(seat, localSeat))
    .then((gltf) => gltf.scene);

import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import {
  playLudoCaptureWeaponSfx,
  LUDO_CAPTURE_FIREARM_SHOT_SOUND_URL,
  LUDO_CAPTURE_FIREARM_SHELL_SOUND_URL,
  LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL
} from '../webapp/src/utils/ludoSfx.js';

test('capture stages preserve local shot, shell and missile sounds without dead remote layers', async () => {
  const originalAudio = globalThis.Audio;
  const played = [];
  globalThis.Audio = class {
    constructor(url) { this.src = url; }
    pause() {}
    play() { played.push(this.src); return Promise.resolve(); }
  };
  try {
    for (const id of ['glockSidearmAttack', 'uziSprayAttack', 'sniperShotAttack', 'polyBazooka01Attack']) {
      played.length = 0;
      assert.equal(playLudoCaptureWeaponSfx(id, 'launch'), true);
      assert.deepEqual(played, [LUDO_CAPTURE_FIREARM_SHOT_SOUND_URL, LUDO_CAPTURE_FIREARM_SHELL_SOUND_URL]);
    }
    played.length = 0;
    assert.equal(playLudoCaptureWeaponSfx('javelinAttack', 'launch'), true);
    assert.deepEqual(played, [LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL]);
    played.length = 0;
    assert.equal(playLudoCaptureWeaponSfx('glockSidearmAttack', 'shot', { muted: true }), false);
    assert.deepEqual(played, []);
    for (const url of [LUDO_CAPTURE_FIREARM_SHOT_SOUND_URL, LUDO_CAPTURE_FIREARM_SHELL_SOUND_URL, LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL]) {
      await access(new URL(`../webapp/public${url}`, import.meta.url));
    }
  } finally {
    if (originalAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = originalAudio;
  }
});

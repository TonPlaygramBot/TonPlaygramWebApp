let sharedCtx = null;
const LUDO_DICE_ROLL_SOUND_URL = '/assets/sounds/u_qpfzpydtro-dice-142528.mp3';
let ludoDiceRollAudio = null;

export const LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL = '/assets/sounds/launch-85216.mp3';
export const LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL = '/assets/sounds/080998_bullet-hit-39870.mp3';
export const LUDO_CAPTURE_FIREARM_SHOT_SOUND_URL = '/assets/sounds/080998_bullet-hit-39870.mp3';
export const LUDO_CAPTURE_FIREARM_SHELL_SOUND_URL = '/assets/ludo/audio/shell.wav';
export const LUDO_CAPTURE_DRONE_SOUND_URL = '/assets/ludo/audio/drone.wav';
export const LUDO_CAPTURE_FIGHTER_SOUND_URL = '/assets/sounds/race-care-151963.mp3';
export const LUDO_CAPTURE_HELICOPTER_SOUND_URL = '/assets/sounds/dragon-studio-helicopter-sound-8d-372463.mp3';

const LUDO_CAPTURE_FIREARM_SOURCE_SOUND_URL_BY_ID = Object.freeze({
  glockSidearmAttack: 'https://cdn.freesound.org/previews/414/414888_5121236-lq.mp3',
  smithSidearmAttack: 'https://cdn.freesound.org/previews/414/414888_5121236-lq.mp3',
  sigsauerTacticalAttack: 'https://cdn.freesound.org/previews/414/414888_5121236-lq.mp3',
  uziSprayAttack: 'https://cdn.freesound.org/previews/171/171104_2437358-lq.mp3',
  smgBurstAttack: 'https://cdn.freesound.org/previews/171/171104_2437358-lq.mp3',
  assaultRifleAttack: 'https://cdn.freesound.org/previews/212/212968_4048940-lq.mp3',
  ak47VolleyAttack: 'https://cdn.freesound.org/previews/212/212968_4048940-lq.mp3',
  krsvBurstAttack: 'https://cdn.freesound.org/previews/212/212968_4048940-lq.mp3',
  compactCarbineAttack: 'https://cdn.freesound.org/previews/212/212968_4048940-lq.mp3',
  sniperShotAttack: 'https://cdn.freesound.org/previews/533/533981_11861866-lq.mp3',
  mosinMarksmanAttack: 'https://cdn.freesound.org/previews/533/533981_11861866-lq.mp3',
  marksmanDmrAttack: 'https://cdn.freesound.org/previews/533/533981_11861866-lq.mp3',
  shotgunBlastAttack: 'https://cdn.freesound.org/previews/456/456035_5121236-lq.mp3',
  fpsGunAttack: 'https://cdn.freesound.org/previews/456/456035_5121236-lq.mp3',
  grenadeBlastAttack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyBazooka01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyGrenadeLauncher01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyDynamiteBomb01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyMolotov01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyGasTank01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyHandGrenade01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3',
  polyTank01Attack: 'https://cdn.freesound.org/previews/514/514644_9960520-lq.mp3'
});

const ludoCaptureAudioCache = new Map();

function playCachedAudio(url, { volume = 1, loop = false } = {}) {
  if (typeof Audio === 'undefined' || !url) return null;
  let audio = ludoCaptureAudioCache.get(url);
  if (!audio) {
    audio = new Audio(url);
    audio.preload = 'auto';
    ludoCaptureAudioCache.set(url, audio);
  }
  audio.pause();
  audio.currentTime = 0;
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.loop = loop;
  audio.play().catch(() => {});
  return audio;
}

export function stopLudoCaptureLoopSfx() {
  ludoCaptureAudioCache.forEach((audio, url) => {
    if (![LUDO_CAPTURE_DRONE_SOUND_URL, LUDO_CAPTURE_FIGHTER_SOUND_URL, LUDO_CAPTURE_HELICOPTER_SOUND_URL].includes(url)) return;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
  });
}

export function playLudoCaptureWeaponSfx(weaponId, stage = 'launch', { volume = 1, muted = false } = {}) {
  if (stage === 'loopStop') {
    stopLudoCaptureLoopSfx();
    return true;
  }
  if (muted || volume <= 0) return false;
  const normalized = typeof weaponId === 'string' ? weaponId : '';
  const v = Math.max(0, Math.min(1, volume));
  if (stage === 'loopStart') {
    if (normalized === 'droneAttack' || normalized === 'ukrainianDroneAttack') return !!playCachedAudio(LUDO_CAPTURE_DRONE_SOUND_URL, { volume: v * 0.42, loop: true });
    if (normalized === 'fighterJetAttack') return !!playCachedAudio(LUDO_CAPTURE_FIGHTER_SOUND_URL, { volume: v, loop: true });
    if (normalized === 'helicopterAttack') return !!playCachedAudio(LUDO_CAPTURE_HELICOPTER_SOUND_URL, { volume: v, loop: true });
    return false;
  }
  if (stage === 'impact') {
    const impact = playCachedAudio(LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL, { volume: v });
    return !!impact;
  }
  if (stage === 'shot') {
    playCachedAudio(LUDO_CAPTURE_FIREARM_SHOT_SOUND_URL, { volume: v });
    playCachedAudio(LUDO_CAPTURE_FIREARM_SHELL_SOUND_URL, { volume: v });
    const sourceUrl = LUDO_CAPTURE_FIREARM_SOURCE_SOUND_URL_BY_ID[normalized];
    if (sourceUrl) playCachedAudio(sourceUrl, { volume: v * 0.9 });
    return true;
  }
  if (stage === 'launch') {
    if (LUDO_CAPTURE_FIREARM_SOURCE_SOUND_URL_BY_ID[normalized]) return playLudoCaptureWeaponSfx(normalized, 'shot', { volume: v, muted });
    return !!playCachedAudio(LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL, { volume: v });
  }
  return false;
}


function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function scheduleTone(ctx, { startAt, duration, fromHz, toHz, volume = 0.4, type = 'triangle' }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), startAt + duration);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + Math.min(0.04, duration * 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function playLudoDiceRollSfx({ volume = 1, muted = false } = {}) {
  if (muted || volume <= 0) return;
  if (typeof Audio === 'undefined') return;
  if (!ludoDiceRollAudio) {
    ludoDiceRollAudio = new Audio(LUDO_DICE_ROLL_SOUND_URL);
    ludoDiceRollAudio.preload = 'auto';
  }
  ludoDiceRollAudio.volume = Math.max(0, Math.min(1, volume));
  ludoDiceRollAudio.currentTime = 0;
  ludoDiceRollAudio.play().catch(() => {});
}

export function playLudoTokenStepSfx({ volume = 1, muted = false } = {}) {
  if (muted || volume <= 0) return;
  playLudoPresentationSfx('/assets/ludo/audio/step.wav', { volume: volume * .55, muted });
}

// Local, deterministic sound assets: no third-party audio request during a shot.
export function ludoWeaponSoundUrl(id = '') {
  const kind = /shotgun|SawedOff/i.test(id) ? 'shotgun'
    : /sniper|mosin|marksman/i.test(id) ? 'marksman'
    : /uzi|smg|FlyingGun/i.test(id) ? 'smg'
    : /glock|pistol|sidearm|sigsauer|revolver/i.test(id) ? 'pistol' : 'rifle';
  return `/assets/ludo/audio/${kind}.wav`;
}
const presentationVoices = [];
export function playLudoPresentationSfx(url, { volume = 1, muted = false } = {}) {
  if (muted || volume <= 0 || typeof Audio === 'undefined') return false;
  let voice = presentationVoices.find(audio => audio.paused || audio.ended);
  if (!voice) {
    voice = new Audio();
    if (presentationVoices.length >= 8) { voice = presentationVoices.shift(); voice.pause(); }
    presentationVoices.push(voice);
  }
  voice.src = url; voice.volume = Math.max(0, Math.min(1, volume));
  voice.currentTime = 0; voice.play().catch(() => {});
  return true;
}

// Runtime-only firearm sound catalog for Chess Battle Royal.
// The current GLTF firearm model sources do not include embedded audio tracks,
// so these CC-BY source URLs are streamed at runtime instead of committing MP3 binaries.
export const CHESS_FIREARM_SOUND_SOURCES = Object.freeze({
  gunshot: Object.freeze({
    label: 'Gunshot Sound Effect',
    author: 'Alexander / Orange Free Sounds',
    license: 'Creative Commons Attribution 4.0 International',
    pageUrl: 'https://orangefreesounds.com/gunshot-sound-effect/',
    audioUrl: 'https://www.orangefreesounds.com/wp-content/uploads/2015/01/Gunshot-sound-effect.mp3'
  }),
  shotgun: Object.freeze({
    label: 'Shotgun Sound',
    author: 'Alexander / Orange Free Sounds',
    license: 'Creative Commons Attribution 4.0 International',
    pageUrl: 'https://orangefreesounds.com/shotgun-sound/',
    audioUrl: 'https://www.orangefreesounds.com/wp-content/uploads/2016/12/Shotgun-sound.mp3'
  }),
  launcher: Object.freeze({
    label: 'Cannon Sound Effect',
    author: 'Alexander / Orange Free Sounds',
    license: 'Creative Commons Attribution 4.0 International',
    pageUrl: 'https://orangefreesounds.com/cannon-sound-effect/',
    audioUrl: 'https://www.orangefreesounds.com/wp-content/uploads/2017/03/Cannon-sound-effect.mp3'
  })
});

export const CHESS_FIREARM_SOUND_PROFILE_BY_TYPE = Object.freeze({
  Pistol: Object.freeze({ sourceKey: 'gunshot', volume: 0.9, playbackRate: 1.16, maxDurationMs: 620 }),
  Revolver: Object.freeze({ sourceKey: 'gunshot', volume: 0.98, playbackRate: 0.92, maxDurationMs: 760 }),
  SMG: Object.freeze({ sourceKey: 'gunshot', volume: 0.56, playbackRate: 1.34, maxDurationMs: 360 }),
  Rifle: Object.freeze({ sourceKey: 'gunshot', volume: 0.82, playbackRate: 0.86, maxDurationMs: 760 }),
  AssaultRifle: Object.freeze({ sourceKey: 'gunshot', volume: 0.84, playbackRate: 0.84, maxDurationMs: 760 }),
  Sniper: Object.freeze({ sourceKey: 'gunshot', volume: 1, playbackRate: 0.72, maxDurationMs: 980 }),
  SniperRifle: Object.freeze({ sourceKey: 'gunshot', volume: 1, playbackRate: 0.72, maxDurationMs: 980 }),
  DMR: Object.freeze({ sourceKey: 'gunshot', volume: 0.94, playbackRate: 0.78, maxDurationMs: 900 }),
  Shotgun: Object.freeze({ sourceKey: 'shotgun', volume: 1, playbackRate: 0.98, maxDurationMs: 950 }),
  GrenadeLauncher: Object.freeze({ sourceKey: 'launcher', volume: 1, playbackRate: 1.08, maxDurationMs: 900 }),
  Launcher: Object.freeze({ sourceKey: 'launcher', volume: 1, playbackRate: 0.94, maxDurationMs: 1050 })
});

export const resolveChessFirearmSoundProfile = (weaponType = 'Rifle') => {
  const baseProfile = CHESS_FIREARM_SOUND_PROFILE_BY_TYPE[weaponType] || CHESS_FIREARM_SOUND_PROFILE_BY_TYPE.Rifle;
  const source = CHESS_FIREARM_SOUND_SOURCES[baseProfile.sourceKey] || CHESS_FIREARM_SOUND_SOURCES.gunshot;
  return Object.freeze({
    ...baseProfile,
    weaponType,
    audioUrl: source.audioUrl,
    attribution: source
  });
};

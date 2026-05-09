import { MURLAN_CHARACTER_THEMES } from './murlanCharacterThemes.js';

const murlanById = new Map(
  MURLAN_CHARACTER_THEMES.map((theme) => [theme.id, theme])
);

const fromMurlan = (id, fallbackIndex = 0) => {
  const theme =
    murlanById.get(id) ??
    MURLAN_CHARACTER_THEMES[fallbackIndex] ??
    MURLAN_CHARACTER_THEMES[0];
  return {
    sourceThemeId: theme?.id ?? id,
    modelUrl: theme?.url,
    modelUrls: theme?.modelUrls ?? (theme?.url ? [theme.url] : []),
    thumbnail: theme?.thumbnail,
    skinTone: theme?.skinTone,
    hairColor: theme?.hairColor,
    eyeColor: theme?.eyeColor,
    source: theme?.source,
    license: theme?.license
  };
};

export const POOL_ROYALE_HUMAN_STORAGE_KEY = 'poolRoyaleHumanPlayer';

export const POOL_ROYALE_HUMAN_PLAYERS = Object.freeze([
  Object.freeze({
    id: 'natural-pro',
    label: 'Natural Pro',
    menuLabel: 'Natural',
    role: 'balanced run-out player',
    description:
      'Uses the Murlan current avatar with balanced pro-style potting, cue-ball control, and low-risk leaves.',
    ...fromMurlan('rpm-current', 0),
    ai: Object.freeze({
      planStyle: 'balanced',
      powerScale: 0.96,
      minPower: 0.36,
      maxPower: 0.92,
      spinBias: Object.freeze({ x: 0, y: -0.03 }),
      aimJitterRad: 0.0018,
      previewDelayScale: 1.04,
      safetyQualityThreshold: 0.18
    })
  }),
  Object.freeze({
    id: 'geometry-master',
    label: 'Geometry Master',
    menuLabel: 'Geometry',
    role: 'thin-cut and exact angle specialist',
    description:
      'RPM 67d411 studies ghost-ball geometry first, using softer speed and minimum side spin for accurate cuts.',
    ...fromMurlan('rpm-67d411', 1),
    ai: Object.freeze({
      planStyle: 'geometry',
      powerScale: 0.9,
      minPower: 0.32,
      maxPower: 0.84,
      spinBias: Object.freeze({ x: 0, y: 0.02 }),
      aimJitterRad: 0.0008,
      previewDelayScale: 1.18,
      safetyQualityThreshold: 0.1
    })
  }),
  Object.freeze({
    id: 'safety-captain',
    label: 'Safety Captain',
    menuLabel: 'Safety',
    role: 'defensive table-control player',
    description:
      'RPM 67f433 takes the safety when the pot is low percentage, just like a patient league player.',
    ...fromMurlan('rpm-67f433', 2),
    ai: Object.freeze({
      planStyle: 'safety',
      powerScale: 0.82,
      minPower: 0.28,
      maxPower: 0.78,
      spinBias: Object.freeze({ x: 0, y: -0.12 }),
      aimJitterRad: 0.0025,
      previewDelayScale: 1.25,
      safetyQualityThreshold: 0.42
    })
  }),
  Object.freeze({
    id: 'bank-artist',
    label: 'Bank Artist',
    menuLabel: 'Banks',
    role: 'rail-first and recovery-shot player',
    description:
      'RPM 67e1b5 is willing to bank or kick from awkward layouts instead of forcing blocked straight pots.',
    ...fromMurlan('rpm-67e1b5', 3),
    ai: Object.freeze({
      planStyle: 'banks',
      powerScale: 1.03,
      minPower: 0.4,
      maxPower: 0.94,
      spinBias: Object.freeze({ x: 0.08, y: -0.04 }),
      aimJitterRad: 0.0032,
      previewDelayScale: 0.98,
      safetyQualityThreshold: 0.22
    })
  }),
  Object.freeze({
    id: 'power-breaker',
    label: 'Power Breaker',
    menuLabel: 'Power',
    role: 'aggressive break-and-run attacker',
    description:
      'Vietnam Human attacks open pockets with firmer speed, follow spin, and decisive break shots.',
    ...fromMurlan('webgl-vietnam-human', 4),
    ai: Object.freeze({
      planStyle: 'power',
      powerScale: 1.13,
      minPower: 0.48,
      maxPower: 1,
      spinBias: Object.freeze({ x: 0, y: 0.11 }),
      aimJitterRad: 0.004,
      previewDelayScale: 0.86,
      safetyQualityThreshold: 0.06
    })
  })
]);

export function resolvePoolRoyaleHumanPlayer(id) {
  return (
    POOL_ROYALE_HUMAN_PLAYERS.find((player) => player.id === id) ??
    POOL_ROYALE_HUMAN_PLAYERS[0]
  );
}

export function applyPoolRoyaleHumanAiProfile(plan, profile, shotIndex = 0) {
  if (!plan || !profile?.ai) return plan;
  const ai = profile.ai;
  const next = { ...plan };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  if (Number.isFinite(next.power)) {
    next.power = clamp(
      next.power * (ai.powerScale ?? 1),
      ai.minPower ?? 0.25,
      ai.maxPower ?? 1
    );
  }
  const baseSpin = next.spin ?? { x: 0, y: 0 };
  next.spin = {
    x: clamp((baseSpin.x ?? 0) + (ai.spinBias?.x ?? 0), -0.5, 0.5),
    y: clamp((baseSpin.y ?? 0) + (ai.spinBias?.y ?? 0), -0.5, 0.5)
  };
  if (next.aimDir?.clone && typeof next.aimDir.rotateAround === 'function') {
    const jitter = ai.aimJitterRad ?? 0;
    if (jitter > 0) {
      const phase = Math.sin(
        (shotIndex + 1) * 12.9898 + profile.id.length * 78.233
      );
      next.aimDir = next.aimDir
        .clone()
        .rotateAround({ x: 0, y: 0 }, phase * jitter)
        .normalize();
    }
  }
  next.aiMeta = {
    ...(next.aiMeta ?? {}),
    humanProfileId: profile.id,
    humanProfileLabel: profile.label,
    planStyle: ai.planStyle
  };
  return next;
}

export function choosePoolRoyaleHumanPlan(options, profile) {
  if (!options) return null;
  const bestPot = options.bestPot ?? null;
  const bestSafety = options.bestSafety ?? null;
  const style = profile?.ai?.planStyle;
  if (style === 'safety' && bestSafety) {
    const potQuality = Number.isFinite(bestPot?.quality)
      ? bestPot.quality
      : Number.isFinite(bestPot?.difficulty)
        ? 1 - Math.min(1, bestPot.difficulty / 1000)
        : 0;
    if (!bestPot || potQuality < (profile.ai.safetyQualityThreshold ?? 0.35)) {
      return bestSafety;
    }
  }
  if (style === 'power' && bestPot) return bestPot;
  if (style === 'banks' && bestPot?.viaCushion) return bestPot;
  return bestPot ?? bestSafety ?? null;
}

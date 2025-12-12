import { FLAG_EMOJIS } from './flagEmojis.js';

export const CHESS_PLAYER_FLAG_KEY = 'chessBattleRoyalPlayerFlag';
export const CHESS_AI_FLAG_KEY = 'chessBattleRoyalAiFlag';

export function getDefaultFlagIndices() {
  const defaultFlagIndex = Math.max(0, FLAG_EMOJIS.indexOf('🌐'));
  let playerIdx = defaultFlagIndex;
  let aiIdx = defaultFlagIndex;

  try {
    const storedPlayer = window.localStorage?.getItem(CHESS_PLAYER_FLAG_KEY);
    const storedAi = window.localStorage?.getItem(CHESS_AI_FLAG_KEY);
    const playerFlagIndex = FLAG_EMOJIS.indexOf(storedPlayer);
    const aiFlagIndex = FLAG_EMOJIS.indexOf(storedAi);
    if (playerFlagIndex >= 0) playerIdx = playerFlagIndex;
    if (aiFlagIndex >= 0) aiIdx = aiFlagIndex;
    else aiIdx = playerIdx;
  } catch {}

  return { playerIdx, aiIdx };
}

export function seedFlags(count, { includePlayer = true } = {}) {
  if (!count) return [];
  const { playerIdx, aiIdx } = getDefaultFlagIndices();

  return Array.from({ length: count }, (_, seat) =>
    includePlayer && seat === 0 ? playerIdx : aiIdx
  );
}

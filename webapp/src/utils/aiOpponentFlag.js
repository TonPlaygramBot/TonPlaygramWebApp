export const RIVAL_FLAGS = {
  '🇦🇱': ['🇷🇸', '🇬🇷', '🇲🇰'],
  '🇷🇸': ['🇽🇌', '🇦🇱', '🇭🇷', '🇧🇦'],
  '🇽🇌': ['🇷🇸'],
  '🇺🇸': ['🇨🇳', '🇷🇺', '🇮🇷', '🇻🇪', '🇰🇵', '🇨🇺'],
  '🇨🇳': ['🇺🇸', '🇮🇳', '🇯🇵', '🇹🇼', '🇵🇭'],
  '🇷🇺': ['🇺🇦', '🇵🇱', '🇺🇸', '🇬🇧', '🇱🇹'],
  '🇮🇳': ['🇵🇰', '🇨🇳'],
  '🇵🇰': ['🇮🇳', '🇦🇫'],
  '🇹🇷': ['🇬🇷', '🇦🇲', '🇨🇾'],
  '🇮🇱': ['🇵🇸', '🇮🇷', '🇸🇾', '🇱🇧'],
  '🇵🇸': ['🇮🇱'],
  '🇮🇷': ['🇺🇸', '🇮🇱', '🇸🇦'],
  '🇸🇦': ['🇮🇷', '🇾🇪', '🇶🇦'],
  '🇦🇲': ['🇦🇿', '🇹🇷'],
  '🇦🇿': ['🇦🇲'],
  '🇬🇧': ['🇷🇺', '🇦🇷'],
  '🇦🇷': ['🇬🇧', '🇨🇱'],
  '🇧🇷': ['🇻🇪', '🇧🇴'],
  '🇻🇪': ['🇺🇸', '🇨🇴', '🇧🇷'],
  '🇰🇵': ['🇰🇷', '🇺🇸', '🇯🇵'],
  '🇰🇷': ['🇰🇵', '🇯🇵'],
  '🇯🇵': ['🇨🇳', '🇰🇷', '🇷🇺'],
  '🇹🇼': ['🇨🇳'],
  '🇲🇽': ['🇺🇸'],
  '🇩🇿': ['🇲🇦', '🇫🇷'],
  '🇲🇦': ['🇩🇿', '🇪🇸'],
  '🇪🇬': ['🇪🇹', '🇸🇩'],
  '🇪🇹': ['🇪🇬', '🇸🇩', '🇪🇷'],
  '🇳🇬': ['🇿🇦'],
  '🇿🇦': ['🇳🇬'],
  '🇸🇾': ['🇮🇱', '🇹🇷', '🇺🇸'],
  '🇨🇺': ['🇺🇸']
};

import { FLAG_EMOJIS } from './flagEmojis.js';

export function getAIOpponentFlag(playerFlag) {
  const rivals = RIVAL_FLAGS[playerFlag];
  if (Array.isArray(rivals) && rivals.length > 0) {
    return rivals[Math.floor(Math.random() * rivals.length)];
  }
  const flags = Object.keys(RIVAL_FLAGS);
  let flag;
  do {
    flag = flags[Math.floor(Math.random() * flags.length)];
  } while (flag === playerFlag);
  return flag;
}

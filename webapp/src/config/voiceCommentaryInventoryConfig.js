export const VOICE_COMMENTARY_DEFAULT_VOICE_ID = 'nova_en_us_f';

const VOICE_LANGUAGE_PACKS = [];

export const VOICE_COMMENTARY_OPTION_LABELS = {
  voiceLanguage: VOICE_LANGUAGE_PACKS.reduce((acc, pack) => {
    acc[pack.locale] = `${pack.language} (${pack.locale})`;
    return acc;
  }, {})
};

export const VOICE_COMMENTARY_STORE_ITEMS = VOICE_LANGUAGE_PACKS.map((pack) => ({
  id: `voice-${pack.locale.toLowerCase()}`,
  type: 'voiceLanguage',
  optionId: pack.locale,
  name: `${pack.language} Commentary Pack`,
  description:
    pack.price === 0
      ? 'Default free English commentary for all games.'
      : `${pack.language} commentary voice unlock for all games.`,
  price: pack.price,
  rarity: pack.price === 0 ? 'free' : 'premium'
}));

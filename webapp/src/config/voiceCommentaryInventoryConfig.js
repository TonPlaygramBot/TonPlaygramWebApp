export const VOICE_COMMENTARY_DEFAULT_VOICE_ID = 'nova_en_us_f';

const VOICE_LANGUAGE_PACKS = [
  { locale: 'en-US', language: 'English', price: 0 },
  { locale: 'es-ES', language: 'Spanish', price: 2200 },
  { locale: 'fr-FR', language: 'French', price: 2200 },
  { locale: 'de-DE', language: 'German', price: 2200 },
  { locale: 'it-IT', language: 'Italian', price: 2200 },
  { locale: 'ja-JP', language: 'Japanese', price: 2600 },
  { locale: 'ko-KR', language: 'Korean', price: 2600 },
  { locale: 'hi-IN', language: 'Hindi', price: 2200 },
  { locale: 'ar-SA', language: 'Arabic', price: 2200 },
  { locale: 'sq-AL', language: 'Albanian', price: 1800 },
  { locale: 'pt-BR', language: 'Portuguese', price: 2200 },
  { locale: 'uk-UA', language: 'Ukrainian', price: 2200 }
];

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

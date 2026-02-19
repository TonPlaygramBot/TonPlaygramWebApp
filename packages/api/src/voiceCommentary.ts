export type CommentaryEventType =
  | 'match_start'
  | 'player_turn'
  | 'score_update'
  | 'streak'
  | 'powerup'
  | 'match_end'
  | 'customer_support';

export type GameKey =
  | 'pool_royale'
  | 'snooker_royal'
  | 'snake_multiplayer'
  | 'texas_holdem'
  | 'domino_royal'
  | 'chess_battle_royal'
  | 'air_hockey'
  | 'goal_rush'
  | 'ludo_battle_royal'
  | 'table_tennis_royal'
  | 'murlan_royale'
  | 'dice_duel'
  | 'snake_and_ladder';

export interface VoiceProfile {
  id: string;
  provider: 'nvidia-personaplex';
  locale: string;
  language: string;
  gender: 'female' | 'male' | 'neutral';
  style: 'energetic' | 'calm' | 'professional' | 'friendly';
  isDefault?: boolean;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'nova_en_us_f', provider: 'nvidia-personaplex', locale: 'en-US', language: 'English', gender: 'female', style: 'energetic', isDefault: true },
  { id: 'atlas_en_us_m', provider: 'nvidia-personaplex', locale: 'en-US', language: 'English', gender: 'male', style: 'professional' },
  { id: 'luna_es_es_f', provider: 'nvidia-personaplex', locale: 'es-ES', language: 'Spanish', gender: 'female', style: 'friendly' },
  { id: 'orion_es_mx_m', provider: 'nvidia-personaplex', locale: 'es-MX', language: 'Spanish', gender: 'male', style: 'energetic' },
  { id: 'selene_fr_fr_f', provider: 'nvidia-personaplex', locale: 'fr-FR', language: 'French', gender: 'female', style: 'calm' },
  { id: 'leo_de_de_m', provider: 'nvidia-personaplex', locale: 'de-DE', language: 'German', gender: 'male', style: 'professional' },
  { id: 'sofia_it_it_f', provider: 'nvidia-personaplex', locale: 'it-IT', language: 'Italian', gender: 'female', style: 'friendly' },
  { id: 'sakura_ja_jp_f', provider: 'nvidia-personaplex', locale: 'ja-JP', language: 'Japanese', gender: 'female', style: 'energetic' },
  { id: 'jin_ko_kr_m', provider: 'nvidia-personaplex', locale: 'ko-KR', language: 'Korean', gender: 'male', style: 'professional' },
  { id: 'maya_hi_in_f', provider: 'nvidia-personaplex', locale: 'hi-IN', language: 'Hindi', gender: 'female', style: 'friendly' },
  { id: 'amir_ar_sa_m', provider: 'nvidia-personaplex', locale: 'ar-SA', language: 'Arabic', gender: 'male', style: 'calm' },
  { id: 'eda_tr_tr_f', provider: 'nvidia-personaplex', locale: 'tr-TR', language: 'Turkish', gender: 'female', style: 'professional' },
  { id: 'anisa_sq_al_f', provider: 'nvidia-personaplex', locale: 'sq-AL', language: 'Albanian', gender: 'female', style: 'friendly' },
  { id: 'ivo_pt_br_m', provider: 'nvidia-personaplex', locale: 'pt-BR', language: 'Portuguese', gender: 'male', style: 'energetic' },
  { id: 'olena_uk_ua_f', provider: 'nvidia-personaplex', locale: 'uk-UA', language: 'Ukrainian', gender: 'female', style: 'calm' },
  { id: 'marek_pl_pl_m', provider: 'nvidia-personaplex', locale: 'pl-PL', language: 'Polish', gender: 'male', style: 'professional' }
];

const GAME_LABELS: Record<GameKey, string> = {
  pool_royale: 'Pool Royale',
  snooker_royal: 'Snooker Royal',
  snake_multiplayer: 'Snake Multiplayer',
  texas_holdem: 'Texas Holdem',
  domino_royal: 'Domino Royal',
  chess_battle_royal: 'Chess Battle Royal',
  air_hockey: 'Air Hockey',
  goal_rush: 'Goal Rush',
  ludo_battle_royal: 'Ludo Battle Royal',
  table_tennis_royal: 'Table Tennis Royal',
  murlan_royale: 'Murlan Royale',
  dice_duel: 'Dice Duel',
  snake_and_ladder: 'Snake and Ladder'
};

export function isGameKey(value: string): value is GameKey {
  return value in GAME_LABELS;
}

function getGameLabel(game: GameKey): string {
  return GAME_LABELS[game];
}

function supportReplyTemplate(language: string, ticketContext: string): string {
  if (language.toLowerCase().startsWith('albanian')) {
    return `Përshëndetje! Faleminderit që na kontaktuat. E kuptova kërkesën tuaj: ${ticketContext}. Po e kontrollojmë menjëherë dhe do t’ju japim hapa të qartë, një nga një.`;
  }

  return `Hi there, thanks for reaching out. I understood your request: ${ticketContext}. We’re checking this now and I’ll walk you through the next steps clearly.`;
}

export function buildCommentaryText(game: GameKey, eventType: CommentaryEventType, playerName: string, score?: string): string {
  const gameLabel = getGameLabel(game);
  const safePlayer = playerName || 'Player';

  switch (eventType) {
    case 'match_start':
      return `Welcome to ${gameLabel}. We’re live, the crowd is ready, and ${safePlayer} is stepping in with confidence.`;
    case 'player_turn':
      return `Your move, ${safePlayer}. Take a breath, line it up, and trust your timing in ${gameLabel}.`;
    case 'score_update':
      return `Score update in ${gameLabel}: ${score ?? 'new score available'}. This match just got a lot more interesting.`;
    case 'streak':
      return `${safePlayer} is heating up in ${gameLabel}. That streak is putting real pressure on everyone else.`;
    case 'powerup':
      return `Power play activated in ${gameLabel}. ${safePlayer} just changed the rhythm of the game.`;
    case 'match_end':
      return `${gameLabel} is complete. Great performance by ${safePlayer}, and a strong finish from both sides.`;
    case 'customer_support':
      return supportReplyTemplate('English', score ?? 'General support request');
    default:
      return `Live update from ${gameLabel}.`;
  }
}

export async function requestPersonaplexSynthesis(input: {
  text: string;
  voiceId: string;
  locale: string;
  metadata?: Record<string, string>;
}): Promise<
  | { mode: 'remote'; provider: 'nvidia-personaplex'; response: unknown }
  | {
      mode: 'local-fallback';
      provider: 'nvidia-personaplex';
      reason: 'missing_credentials';
      message: string;
      payload: {
        text: string;
        voiceId: string;
        locale: string;
        metadata: Record<string, string>;
      };
    }
> {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  const localFallbackEnabled = process.env.PERSONAPLEX_LOCAL_FALLBACK !== '0';

  const ssml = `<speak><lang xml:lang="${input.locale}">${input.text}</lang></speak>`;

  if (!endpoint || !apiKey) {
    if (!localFallbackEnabled) {
      throw new Error('PersonaPlex is not configured. Set PERSONAPLEX_API_URL and PERSONAPLEX_API_KEY.');
    }

    return {
      mode: 'local-fallback',
      provider: 'nvidia-personaplex',
      reason: 'missing_credentials',
      message: 'PersonaPlex credentials are missing. Using local fallback payload for development.',
      payload: {
        text: input.text,
        voiceId: input.voiceId,
        locale: input.locale,
        metadata: input.metadata ?? {}
      }
    };
  }

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/v1/speech/synthesize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: input.text,
      ssml,
      voice: input.voiceId,
      locale: input.locale,
      metadata: input.metadata ?? {}
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PersonaPlex synthesis failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  return { mode: 'remote', provider: 'nvidia-personaplex', response: payload };
}

export function findVoiceProfile(voiceId?: string, locale?: string): VoiceProfile {
  if (voiceId) {
    const match = VOICE_PROFILES.find((voice) => voice.id === voiceId);
    if (match) return match;
  }

  if (locale) {
    const localeMatch = VOICE_PROFILES.find((voice) => voice.locale.toLowerCase() === locale.toLowerCase());
    if (localeMatch) return localeMatch;
  }

  return VOICE_PROFILES.find((voice) => voice.isDefault) ?? VOICE_PROFILES[0];
}

export function buildSupportSpeech(ticketContext: string, voice: VoiceProfile): string {
  return supportReplyTemplate(voice.language, ticketContext);
}

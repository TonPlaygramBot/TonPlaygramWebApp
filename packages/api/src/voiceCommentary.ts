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

function generateSineWavBase64(seedText: string): string {
  const sampleRate = 22050;
  const durationSec = Math.max(1, Math.min(4, Math.floor(seedText.length / 40) || 1));
  const count = sampleRate * durationSec;
  const freq = 240 + (seedText.length % 180);
  const amplitude = 5000;

  const pcm = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRate;
    const sample = Math.round(amplitude * Math.sin(2 * Math.PI * freq * t));
    pcm.writeInt16LE(sample, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString('base64');
}

function coalesceAudioPayload(payload: Record<string, unknown>) {
  const audioUrl =
    (typeof payload.audioUrl === 'string' && payload.audioUrl) ||
    (typeof payload.audio_url === 'string' && payload.audio_url) ||
    '';
  const audioBase64 =
    (typeof payload.audioBase64 === 'string' && payload.audioBase64) ||
    (typeof payload.audio_base64 === 'string' && payload.audio_base64) ||
    (typeof payload.audioContent === 'string' && payload.audioContent) ||
    (typeof payload.audio_content === 'string' && payload.audio_content) ||
    '';
  const mimeType =
    (typeof payload.mimeType === 'string' && payload.mimeType) ||
    (typeof payload.mime_type === 'string' && payload.mime_type) ||
    'audio/wav';

  return { audioUrl, audioBase64, mimeType };
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
      reason: 'missing_credentials' | 'remote_unavailable';
      message: string;
      payload: {
        text: string;
        voiceId: string;
        locale: string;
        metadata: Record<string, string>;
        audioBase64: string;
        mimeType: string;
      };
    }
> {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  const localFallbackEnabled = process.env.PERSONAPLEX_LOCAL_FALLBACK !== '0';
  const ttsPath = process.env.PERSONAPLEX_TTS_PATH || '/v1/speech/synthesize';
  const model = process.env.PERSONAPLEX_MODEL || '';

  const fallbackPayload = {
    text: input.text,
    voiceId: input.voiceId,
    locale: input.locale,
    metadata: input.metadata ?? {},
    audioBase64: generateSineWavBase64(input.text),
    mimeType: 'audio/wav'
  };

  if (!endpoint || !apiKey) {
    if (!localFallbackEnabled) {
      throw new Error('PersonaPlex is not configured. Set PERSONAPLEX_API_URL and PERSONAPLEX_API_KEY.');
    }

    return {
      mode: 'local-fallback',
      provider: 'nvidia-personaplex',
      reason: 'missing_credentials',
      message: 'PersonaPlex credentials are missing. Using local audio fallback for development.',
      payload: fallbackPayload
    };
  }

  const baseUrl = endpoint.replace(/\/$/, '');
  const body: Record<string, unknown> = {
    input: input.text,
    text: input.text,
    voice: input.voiceId,
    locale: input.locale,
    response_format: 'wav',
    metadata: input.metadata ?? {}
  };
  if (model) body.model = model;

  try {
    const response = await fetch(`${baseUrl}${ttsPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`PersonaPlex synthesis failed (${response.status}): ${details}`);
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('audio/')) {
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      return {
        mode: 'remote',
        provider: 'nvidia-personaplex',
        response: {
          audioBase64: audioBuffer.toString('base64'),
          mimeType: contentType
        }
      };
    }

    const jsonPayload = (await response.json()) as Record<string, unknown>;
    const normalized = coalesceAudioPayload(jsonPayload);
    if (!normalized.audioUrl && !normalized.audioBase64) {
      throw new Error('PersonaPlex response missing audio fields');
    }

    return {
      mode: 'remote',
      provider: 'nvidia-personaplex',
      response: {
        ...jsonPayload,
        ...normalized
      }
    };
  } catch (error) {
    if (!localFallbackEnabled) throw error;
    return {
      mode: 'local-fallback',
      provider: 'nvidia-personaplex',
      reason: 'remote_unavailable',
      message: `PersonaPlex remote unavailable (${(error as Error).message}). Using local audio fallback.`,
      payload: fallbackPayload
    };
  }
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

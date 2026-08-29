export interface VoiceProfile {
  id: string;
  locale: string;
  name: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  ['en-US', 'English US'], ['en-GB', 'English UK'], ['sq-AL', 'Albanian'],
  ['de-DE', 'German'], ['fr-FR', 'French'], ['it-IT', 'Italian'],
  ['es-ES', 'Spanish'], ['pt-PT', 'Portuguese'], ['tr-TR', 'Turkish'],
  ['uk-UA', 'Ukrainian'], ['ar-SA', 'Arabic'], ['hi-IN', 'Hindi']
].map(([locale, name]) => ({ id: `local-${locale}`, locale, name }));

export function findVoiceProfile(voiceId?: string, locale = 'en-US'): VoiceProfile {
  return VOICE_PROFILES.find((voice) => voice.id === voiceId)
    || VOICE_PROFILES.find((voice) => voice.locale.toLowerCase() === locale.toLowerCase())
    || VOICE_PROFILES[0];
}

export function buildCommentaryText(game: string, event: string, player = ''): string {
  const label = game.replace(/_/g, ' ');
  if (event === 'match_start') return `${player ? `${player}, ` : ''}the ${label} match is starting.`;
  return `${player ? `${player}: ` : ''}${event.replace(/_/g, ' ')} in ${label}.`;
}

export function buildSupportSpeech(question: string, voice: VoiceProfile): string {
  if (voice.locale === 'sq-AL') return `Përshëndetje. Do t'ju ndihmoj me: ${question}`;
  return `Hello. I will help you with: ${question}`;
}

type SynthesisRequest = { text: string; locale: string; voiceId: string };

export async function requestPersonaplexSynthesis(payload: SynthesisRequest) {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  if (!endpoint || !apiKey) {
    if (process.env.PERSONAPLEX_LOCAL_FALLBACK === '0') throw new Error('PersonaPlex is not configured');
    return { mode: 'local-fallback' as const, reason: 'missing_credentials' as const, payload };
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`PersonaPlex request failed (${response.status})`);
  return { mode: 'remote' as const, payload: await response.json() };
}

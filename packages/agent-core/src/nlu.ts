import { detectGameEntity } from './lexicon.js';
import type { NluResult, SupportIntent } from './types.js';

const INTENT_PATTERNS: Array<{ intent: SupportIntent; pattern: RegExp }> = [
  { intent: 'account_login', pattern: /(login|log in|sign in|password|account locked|2fa)/i },
  { intent: 'profile', pattern: /(profile|avatar|username|name change)/i },
  { intent: 'lobby_matchmaking', pattern: /(lobby|matchmaking|queue|opponent find)/i },
  { intent: 'gameplay_rules', pattern: /(rule|foul|score|8-ball|9-ball|snooker)/i },
  { intent: 'fair_play', pattern: /(cheat|fair play|collusion|harassment)/i },
  { intent: 'store_items', pattern: /(store|shop|item|cue|skin)/i },
  { intent: 'payments_coins_points', pattern: /(coin|point|top[- ]?up|deposit|payment)/i },
  { intent: 'refunds', pattern: /(refund|chargeback|return)/i },
  { intent: 'tournaments', pattern: /(tournament|bracket|knockout)/i },
  { intent: 'connectivity_performance', pattern: /(lag|disconnect|ping|fps|stutter|connection)/i },
  { intent: 'reporting_moderation', pattern: /(report player|report|abuse|toxic)/i },
  { intent: 'how_to_guides', pattern: /(how to|guide|tutorial|steps)/i },
  { intent: 'bugs_feedback', pattern: /(bug|feedback|issue|glitch|crash)/i }
];

export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/lobi/g, 'lobby')
    .replace(/spini/g, 'spin')
    .replace(/faull/g, 'foul')
    .replace(/breyk/g, 'break');
}

export function detectLanguage(input: string): NluResult['language'] {
  const lower = input.toLowerCase();
  const albanianMarkers = /(qfare|si mund|ndihme|lobi|faull|rregulla)/;
  const englishMarkers = /(how|help|rule|login|matchmaking|refund)/;

  if (albanianMarkers.test(lower) && englishMarkers.test(lower)) return 'mixed';
  if (albanianMarkers.test(lower)) return 'sq';
  if (englishMarkers.test(lower)) return 'en';
  return 'unknown';
}

export function classifyIntent(normalizedText: string): SupportIntent {
  const match = INTENT_PATTERNS.find(({ pattern }) => pattern.test(normalizedText));
  return match?.intent ?? 'unknown';
}

export function runNLU(input: string): NluResult {
  const normalizedText = normalizeText(input);
  const intent = classifyIntent(normalizedText);
  const game = detectGameEntity(normalizedText);

  const platform = /(android|ios|web)/i.exec(input)?.[1]?.toLowerCase();
  const version = /(v?\d+\.\d+(?:\.\d+)?)/i.exec(input)?.[1];

  const needsClarification = intent === 'unknown';

  return {
    normalizedText,
    language: detectLanguage(input),
    intent,
    entities: {
      game,
      platform,
      version,
      feature: /(lobby|invite|rematch|rankings|shop|coins|points)/i.exec(normalizedText)?.[1]
    },
    needsClarification,
    clarificationQuestion: needsClarification
      ? 'Could you share whether this is about account access, gameplay rules, store/payments, or connection issues?'
      : undefined
  };
}

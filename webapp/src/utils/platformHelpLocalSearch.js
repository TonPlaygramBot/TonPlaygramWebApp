import { PLATFORM_HELP_KNOWLEDGE } from '../data/platformHelpKnowledge.js';

const SENSITIVE_PATTERNS = [
  /api[\s_-]?keys?/i,
  /private key/i,
  /seed phrase/i,
  /internal/i,
  /database/i,
  /admin/i,
  /exploit|hack|bypass|fraud|scam/i,
  /logs?|stack trace|env|token/i
];

const LEXICON = {
  lobi: 'lobby',
  faull: 'foul',
  spini: 'spin',
  breyk: 'break',
  kestik: 'cue stick',
  topup: 'top-up'
};

export function normalizeHelpQuery(query) {
  let normalized = String(query || '').toLowerCase().trim().replace(/\s+/g, ' ');
  Object.entries(LEXICON).forEach(([from, to]) => {
    normalized = normalized.replace(new RegExp(from, 'g'), to);
  });
  return normalized;
}

function scoreItem(query, item) {
  const tokens = query.split(' ').filter(Boolean);
  const hay = `${item.title} ${item.question || ''} ${item.answer} ${item.tags.join(' ')} ${item.slug}`.toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (hay.includes(token)) score += token.length > 4 ? 2 : 1;
  });
  return score;
}

export function searchLocalHelp(query, topK = 3) {
  const normalized = normalizeHelpQuery(query);
  const ranked = PLATFORM_HELP_KNOWLEDGE.map((item) => ({ item, score: scoreItem(normalized, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked.map((entry) => entry.item);
}

export function isSensitiveHelpRequest(query) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(String(query || '')));
}

export function buildStructuredResponse(query, sources) {
  if (!sources.length) {
    return {
      answer:
        'I do not have enough public information to answer that safely yet. Could you clarify the exact page or game mode?',
      citations: []
    };
  }

  const best = sources[0];
  const steps = best.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const notes = best.notes.map((note) => `- ${note}`).join('\n');

  return {
    answer: `${best.answer}\n\n${steps}\n\n${notes}\n\nIf this does not fix it: Please contact support from the Help section and include your app version, page name, and screenshots.`,
    citations: sources.map((source) => ({
      title: source.title,
      slug: source.slug,
      sectionId: source.sectionId,
      url: source.url
    }))
  };
}

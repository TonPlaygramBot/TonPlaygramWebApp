import type { Citation, PublicArticle } from './types.js';
import { runNLU } from './nlu.js';
import { retrievePublicArticles } from './retrieval.js';
import { evaluateUserPrompt, redactSensitive } from './safety.js';

export interface AgentReply {
  answer: string;
  language: string;
  intent: string;
  citations: Citation[];
  metadata: {
    usedArticleIds: string[];
    confidence: number;
  };
}

function toCitation(article: PublicArticle): Citation {
  return {
    title: article.title,
    slug: article.slug,
    sectionId: article.sectionId,
    url: article.url
  };
}

const LANGUAGE_LABELS: Record<string, string> = {
  'en-US': 'English',
  'sq-AL': 'Albanian',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese',
  'tr-TR': 'Turkish',
  'ar-SA': 'Arabic',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'hi-IN': 'Hindi',
  'uk-UA': 'Ukrainian',
  'pl-PL': 'Polish'
};

function detectPreferredLanguage(preferredLocale: string | undefined, nluLanguage: string): string {
  if (preferredLocale && LANGUAGE_LABELS[preferredLocale]) {
    return LANGUAGE_LABELS[preferredLocale];
  }

  if (nluLanguage === 'sq') return 'Albanian';
  return 'English';
}

function conversationalFrame(language: string): { intro: string; outro: string; fallback: string } {
  if (language === 'Albanian') {
    return {
      intro: 'Po të ndihmoj menjëherë. Le ta zgjidhim hap pas hapi.',
      outro: 'Nëse dëshiron, vazhdojmë me pyetje të shkurtra derisa ta rregullojmë plotësisht.',
      fallback:
        'Nuk kam mjaftueshëm informacion publik për ta konfirmuar me siguri. Më thuaj mode-in e lojës dhe nëse je në Android, iOS apo Web.'
    };
  }

  return {
    intro: "I can help with that right away. Let's solve it step by step.",
    outro: 'If you want, we can keep going in short back-and-forth messages until it is fully fixed.',
    fallback:
      'I do not have enough public information to confirm that safely yet. Tell me your game mode and whether this is on Android, iOS, or Web.'
  };
}

export function answerUserQuestion(
  input: string,
  articles: PublicArticle[],
  options?: { preferredLocale?: string }
): AgentReply {
  const safety = evaluateUserPrompt(input);
  const nlu = runNLU(input);
  const language = detectPreferredLanguage(options?.preferredLocale, nlu.language);
  const frame = conversationalFrame(language);

  if (!safety.allowed) {
    return {
      answer: safety.reason!,
      language,
      intent: 'blocked',
      citations: [],
      metadata: { usedArticleIds: [], confidence: 1 }
    };
  }

  if (nlu.needsClarification) {
    return {
      answer: `${frame.fallback} ${nlu.clarificationQuestion}`,
      language,
      intent: nlu.intent,
      citations: [],
      metadata: { usedArticleIds: [], confidence: 0.2 }
    };
  }

  const hits = retrievePublicArticles(nlu.normalizedText, articles, 3);
  const confidence = hits[0]?.score ?? 0;

  if (!hits.length || confidence < 0.18) {
    return {
      answer: frame.fallback,
      language,
      intent: nlu.intent,
      citations: [],
      metadata: { usedArticleIds: [], confidence }
    };
  }

  const top = hits[0].article;
  const body = [
    frame.intro,
    `Here is the public guidance: ${top.content.split('\n')[0]}`,
    '1. Follow the in-app flow described in the help article for your feature.',
    '2. Double-check your selected game mode and current app version.',
    '3. If behavior differs, send feedback through support with reproducible steps.',
    '- I can only provide user-facing public documentation.',
    '- I cannot access private account, moderation, or internal system details.',
    'If this does not fix it: Contact support from the Help menu and include screenshots plus app version.',
    frame.outro
  ].join('\n');

  const safeAnswer = redactSensitive(body);
  return {
    answer: safeAnswer,
    language,
    intent: nlu.intent,
    citations: hits.map((hit) => toCitation(hit.article)),
    metadata: {
      usedArticleIds: hits.map((hit) => hit.article.id),
      confidence
    }
  };
}

import type { Citation, PublicArticle } from './types.js';
import { runNLU } from './nlu.js';
import { retrievePublicArticles } from './retrieval.js';
import { evaluateUserPrompt, redactSensitive } from './safety.js';

export interface AgentReply {
  answer: string;
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

export function answerUserQuestion(input: string, articles: PublicArticle[]): AgentReply {
  const safety = evaluateUserPrompt(input);
  if (!safety.allowed) {
    return {
      answer: safety.reason!,
      intent: 'blocked',
      citations: [],
      metadata: { usedArticleIds: [], confidence: 1 }
    };
  }

  const nlu = runNLU(input);
  if (nlu.needsClarification) {
    return {
      answer: `I don’t have enough public information to answer that yet. ${nlu.clarificationQuestion}`,
      intent: nlu.intent,
      citations: [],
      metadata: { usedArticleIds: [], confidence: 0.2 }
    };
  }

  const hits = retrievePublicArticles(nlu.normalizedText, articles, 3);
  const confidence = hits[0]?.score ?? 0;

  if (!hits.length || confidence < 0.18) {
    return {
      answer:
        'I don’t have enough public information to confirm that safely. Could you share your game mode and whether this is on Android, iOS, or Web?',
      intent: nlu.intent,
      citations: [],
      metadata: { usedArticleIds: [], confidence }
    };
  }

  const top = hits[0].article;
  const body = [
    `Here is the public guidance: ${top.content.split('\n')[0]}`,
    '1. Follow the in-app flow described in the help article for your feature.',
    '2. Double-check your selected game mode and current app version.',
    '3. If behavior differs, send feedback through support with reproducible steps.',
    '- I can only provide user-facing public documentation.',
    '- I cannot access private account, moderation, or internal system details.',
    'If this does not fix it: Contact support from the Help menu and include screenshots plus app version.'
  ].join('\n');

  const safeAnswer = redactSensitive(body);
  return {
    answer: safeAnswer,
    intent: nlu.intent,
    citations: hits.map((hit) => toCitation(hit.article)),
    metadata: {
      usedArticleIds: hits.map((hit) => hit.article.id),
      confidence
    }
  };
}

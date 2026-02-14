import { expandQuery } from './lexicon.js';
import type { PublicArticle, RetrievalResult } from './types.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(queryTokens: string[], docTokens: string[]): number {
  const q = new Set(queryTokens);
  let count = 0;
  docTokens.forEach((token) => {
    if (q.has(token)) count += 1;
  });
  return count / Math.max(q.size, 1);
}

export function retrievePublicArticles(query: string, articles: PublicArticle[], topK = 4): RetrievalResult[] {
  const expanded = [query, ...expandQuery(query)].join(' ');
  const queryTokens = tokenize(expanded);

  return articles
    .map((article) => {
      const docTokens = tokenize(`${article.title} ${article.content} ${article.slug}`);
      const score = overlapScore(queryTokens, docTokens);
      const q = query.toLowerCase();
      const gameBoost =
        (q.includes('snooker') && article.slug.includes('snooker')) ||
        (q.includes('8-ball') && article.slug.includes('8-ball')) ||
        (q.includes('9-ball') && article.slug.includes('9-ball'))
          ? 0.35
          : 0;
      const rulesBoost = q.includes('foul') && article.sourcePath.startsWith('rules/') ? 0.2 : 0;
      return { article, score: score + gameBoost + rulesBoost };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

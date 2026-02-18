const LEXICON: Record<string, Array<{ term: string; weight: number }>> = {
  lobby: [
    { term: 'lobi', weight: 0.9 },
    { term: 'matchmaking', weight: 1 },
    { term: 'queue', weight: 0.8 }
  ],
  spin: [
    { term: 'spini', weight: 1 },
    { term: 'english', weight: 0.7 }
  ],
  'cue stick': [
    { term: 'cuestick', weight: 1 },
    { term: 'kestik', weight: 0.9 }
  ],
  foul: [
    { term: 'faull', weight: 1 },
    { term: 'penalty', weight: 0.7 }
  ],
  topup: [
    { term: 'top-up', weight: 1 },
    { term: 'deposit', weight: 0.8 }
  ],
  coins: [
    { term: 'points', weight: 0.6 },
    { term: 'credits', weight: 0.5 }
  ],
  break: [{ term: 'breyk', weight: 1 }]
};

export function expandQuery(text: string, topK = 6): string[] {
  const lower = text.toLowerCase();
  const expansions: Array<{ term: string; weight: number }> = [];

  Object.entries(LEXICON).forEach(([key, synonyms]) => {
    if (lower.includes(key) || synonyms.some((item) => lower.includes(item.term))) {
      expansions.push(...synonyms, { term: key, weight: 1 });
    }
  });

  return expansions
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topK)
    .map((item) => item.term);
}

export function detectGameEntity(text: string): string | undefined {
  const lower = text.toLowerCase();
  const games = ['8-ball', '9-ball', 'snooker', 'poker', 'domino', 'air hockey'];
  return games.find((game) => lower.includes(game));
}

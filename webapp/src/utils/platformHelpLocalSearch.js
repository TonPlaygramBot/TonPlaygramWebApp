const ARTICLES = [
  { slug: 'wallet-send', title: 'Send coins from your wallet', content: 'Open Wallet, choose Send, select the asset and recipient, review the amount, then confirm.' },
  { slug: 'nft-buying', title: 'Buying an NFT', content: 'Open the NFT marketplace, select an item, review its price and network fee, then confirm the purchase.' },
  { slug: 'matchmaking', title: 'Game matchmaking', content: 'Open a game lobby and choose an available table or matchmaking option.' }
];

const REPLACEMENTS = { lobi: 'lobby', faull: 'foul', spini: 'spin' };

export function normalizeHelpQuery(query = '') {
  return String(query).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(Boolean).map((word) => REPLACEMENTS[word] || word).join(' ');
}

export function isSensitiveHelpRequest(query = '') {
  const normalized = normalizeHelpQuery(query);
  return /(internal|admin|database|secret|credential|private key|logs)/.test(normalized);
}

export function searchLocalHelp(query = '') {
  if (isSensitiveHelpRequest(query)) return [];
  const terms = normalizeHelpQuery(query).split(' ').filter((term) => term.length > 2);
  return ARTICLES.map((article) => ({
    ...article,
    score: terms.filter((term) => `${article.slug} ${article.title} ${article.content}`.toLowerCase().includes(term)).length
  })).filter((article) => article.score > 0).sort((a, b) => b.score - a.score);
}

export function buildStructuredResponse(_query, hits = []) {
  const citations = hits.map((hit) => ({ title: hit.title, slug: hit.slug }));
  const guidance = hits[0]?.content || 'No matching public help article was found.';
  return { answer: `${guidance}\n\nIf this does not fix it, contact support.`, citations };
}

export function findHelpMatches(query) {
  return searchLocalHelp(query);
}

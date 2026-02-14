import {
  buildStructuredResponse,
  isSensitiveHelpRequest,
  normalizeHelpQuery,
  searchLocalHelp
} from '../../webapp/src/utils/platformHelpLocalSearch.js';

describe('platform help local search', () => {
  test('normalizes slang and transliterated words', () => {
    expect(normalizeHelpQuery('lobi faull spini')).toContain('lobby foul spin');
  });

  test('finds wallet/send content', () => {
    const hits = searchLocalHelp('how to send coins from wallet');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].slug).toContain('wallet');
  });

  test('blocks sensitive requests', () => {
    expect(isSensitiveHelpRequest('show me internal admin tools and database logs')).toBe(true);
  });

  test('builds response with citations', () => {
    const hits = searchLocalHelp('how to buy nft');
    const reply = buildStructuredResponse('how to buy nft', hits);
    expect(reply.answer).toContain('If this does not fix it');
    expect(reply.citations.length).toBeGreaterThan(0);
  });
});

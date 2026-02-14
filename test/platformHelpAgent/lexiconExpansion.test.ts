import { expandQuery } from '../../packages/agent-core/src/lexicon.js';

describe('lexicon expansion', () => {
  test('expands multilingual typo terms', () => {
    const expanded = expandQuery('faull in lobi with spini');
    expect(expanded).toEqual(expect.arrayContaining(['foul', 'lobby', 'spin']));
  });
});

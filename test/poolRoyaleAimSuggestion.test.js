import {
  buildPoolSuggestionKey,
  shouldApplyPoolSuggestion
} from '../webapp/src/pages/Games/poolRoyaleAimSuggestion.js';

describe('Pool Royale aim suggestion control', () => {
  it('builds a stable key from target + pocket', () => {
    const key = buildPoolSuggestionKey({
      type: 'pot',
      targetBall: { id: 7 },
      pocketId: 'TR'
    });
    expect(key).toBe('pot:7:TR');
  });

  it('returns null when no target exists', () => {
    expect(buildPoolSuggestionKey(null)).toBeNull();
    expect(buildPoolSuggestionKey({ type: 'pot' })).toBeNull();
  });

  it('does not re-apply the same suggestion unless forced', () => {
    expect(
      shouldApplyPoolSuggestion({
        currentKey: 'pot:7:TR',
        nextKey: 'pot:7:TR'
      })
    ).toBe(false);
    expect(
      shouldApplyPoolSuggestion({
        currentKey: 'pot:7:TR',
        nextKey: 'pot:7:TR',
        forceRefresh: true
      })
    ).toBe(true);
  });

  it('always allows snapping when auto-aim is requested', () => {
    expect(
      shouldApplyPoolSuggestion({
        preferAutoAim: true,
        currentKey: 'pot:7:TR',
        nextKey: 'pot:7:TR'
      })
    ).toBe(true);
  });
});

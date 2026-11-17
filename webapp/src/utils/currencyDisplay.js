// Native Toncoin was renamed Gram. Keep legacy TON protocol/API identifiers intact.
// Official branding: https://ton.org/media/ (verified 2026-11-17).
export const GRAM_ICON = '/assets/icons/GRAM.svg';
export function currencyLabel(symbol) {
  return String(symbol || '').toUpperCase() === 'TON' ? 'GRAM' : symbol;
}
// Only the verified native market identity is rebranded, never an unrelated GRAM jetton.
export function nativeMarketDisplay(coin) {
  if (!coin || coin.id !== 'the-open-network') return coin;
  return { ...coin, name: 'Gram', symbol: 'GRAM', image: GRAM_ICON };
}

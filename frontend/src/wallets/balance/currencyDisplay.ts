// Display-only native currency rebrand. TON remains the blockchain/API identifier.
export function walletCurrencyLabel(chain: string, symbol: string): string {
  return chain === 'ton' && symbol.toUpperCase() === 'TON' ? 'GRAM' : symbol;
}

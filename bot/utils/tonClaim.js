// Legacy token is retired. No environment override may reopen this signer.
// DB balances remain off-chain; no replacement contract has been approved.
export default async function tonClaim() {
  const error = new Error('External token claims are unavailable: legacy token retired');
  error.code = 'legacy_token_retired';
  throw error;
}

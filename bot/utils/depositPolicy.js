/** No feature flag may bypass on-chain verification. This handler deliberately
 * has no account, database, notification, or blockchain dependencies.
 */
export function rejectUnverifiedDeposit(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({
    error: 'TON deposits are temporarily unavailable. Do not send funds.',
    code: 'deposit_verification_unavailable'
  });
}

export function rejectUnverifiedReward(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({
    error: 'Client-awarded TPG rewards are temporarily unavailable.',
    code: 'reward_verification_unavailable'
  });
}

// Existing balances may contain unverified client credits. Neither withdrawal
// entry point may transmit value until provenance and authorization are audited.
export function rejectUnverifiedWithdrawal(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({
    error: 'External TPG withdrawals are temporarily unavailable.',
    code: 'withdrawal_verification_unavailable'
  });
}

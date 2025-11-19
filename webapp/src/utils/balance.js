export function getNumericBalance(response) {
  if (!response || response.balance == null) return null;
  const value =
    typeof response.balance === 'number'
      ? response.balance
      : Number(response.balance);
  return Number.isFinite(value) ? value : null;
}

export function isBalanceInsufficient(response, requiredAmount) {
  const balance = getNumericBalance(response);
  const required = Number(requiredAmount);
  if (balance == null || !Number.isFinite(required)) {
    return false;
  }
  return balance < required;
}

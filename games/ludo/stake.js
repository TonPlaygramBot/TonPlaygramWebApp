export function computePayout(stake, players) {
  const pot = stake * players;
  const fee = Math.round(pot * 0.10);
  return { pot, fee, net: pot - fee };
}

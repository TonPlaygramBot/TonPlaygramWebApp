export function calculateTpcAmount(tonAmount, price) {
  const ton = parseFloat(tonAmount);
  const p = parseFloat(price);
  if (!ton || !p) return '';
  const tpc = ton / p;
  return tpc.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

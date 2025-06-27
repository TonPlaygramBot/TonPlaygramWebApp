export function canEnterGame(values) {
  return values.some(v => Number(v) === 6);
}

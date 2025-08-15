// Simple deterministic dice roller with optional seed
export function rollDice(seed) {
  const random = seed != null ? Math.abs(Math.sin(seed)) : Math.random();
  const value = Math.floor(random * 6) + 1;
  return Promise.resolve(value);
}

export const SNAKE_FINAL_TILE = 50;

/**
 * Shared movement rules for the authoritative server and local Snake matches.
 * @param {number} position
 * @param {number | number[]} dice
 * @param {number} finalTile
 */
export function resolveSnakeRoll(position, dice, finalTile = SNAKE_FINAL_TILE) {
  const values = (Array.isArray(dice) ? dice : [dice]).map(Number);
  const valid = values.length > 0 && values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6);
  const total = valid ? values.reduce((sum, value) => sum + value, 0) : 0;
  const enters = valid && values.includes(6);
  const extraTurn = valid && values.every((value) => value === 6);
  const landing = position === 0
    ? enters ? 1 : 0
    : position < finalTile && position + total <= finalTile ? position + total : position;
  return { total, enters, extraTurn, landing, moved: landing !== position };
}

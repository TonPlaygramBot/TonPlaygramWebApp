import gamesCatalog from '../../config/gamesCatalog.js';

/** Same live catalogue as Games: no stale list of retired games or guessed URLs.
 * Kept dependency-free so the invitation server can use it as an allowlist. */
export const MALL_GAMES = Object.freeze(gamesCatalog.map((game, index) => Object.freeze({
  slug: game.slug,
  name: game.name,
  route: game.route,
  image: game.image,
  description: game.description,
  hall: index + 1,
  side: index % 2 === 0 ? -1 : 1,
  row: Math.floor(index / 2)
})));
export function mallGameFor(slug) {
  return MALL_GAMES.find(game => game.slug === slug) || null;
}
export function mallHallPosition(index, count = MALL_GAMES.length) {
  const rows = Math.ceil(count / 2), spacing = Math.min(6.2, 36 / Math.max(1, rows));
  return { x: index % 2 === 0 ? -11 : 11, z: (rows - 1) * spacing / 2 - Math.floor(index / 2) * spacing, width: 12, depth: spacing - .5 };
}

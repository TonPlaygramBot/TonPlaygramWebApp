/** The atlas may grow without changing playable geometry or the routing graph.
 * Coordinates retain the original Tirana WORLD metre frame. */
export function expandedAtlasBounds(cityBounds, references, margin = 450) {
  if (!Array.isArray(cityBounds) || cityBounds.length !== 4 ||
      !cityBounds.every(Number.isFinite) || cityBounds[0] >= cityBounds[2] ||
      cityBounds[1] >= cityBounds[3]) throw new Error('Invalid city bounds');
  if (!Array.isArray(references) || !Number.isFinite(margin) || margin < 0 || margin > 5000)
    throw new Error('Invalid atlas extension');
  const result = [...cityBounds];
  for (const point of references) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z))
      throw new Error('Invalid regional reference point');
    result[0] = Math.min(result[0], point.x - margin);
    result[1] = Math.min(result[1], point.z - margin);
    result[2] = Math.max(result[2], point.x + margin);
    result[3] = Math.max(result[3], point.z + margin);
  }
  return Object.freeze(result);
}
/** Availability always follows the existing playable bounds, never atlas bounds. */
export function atlasPin(point, cityBounds) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z))
    throw new Error('Invalid map pin');
  return { ...point, available: point.x >= cityBounds[0] && point.x <= cityBounds[2]
    && point.z >= cityBounds[1] && point.z <= cityBounds[3] };
}

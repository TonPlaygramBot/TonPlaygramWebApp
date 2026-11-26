import {loadCityAssetBytes} from './cityAssetBytes.mjs';

export const SOLO_CITY_PATH = '/assets/tirana-streets/city.glb';

/** City is mandatory after Play; start its same cached transfer while the
 * solo module downloads. Never speculatively transfer it on the picker. */
export async function warmSoloCity({signal, connection, load = loadCityAssetBytes} = {}) {
  if (signal?.aborted || connection?.saveData || /^(slow-)?2g$/i.test(connection?.effectiveType ?? ''))
    return false;
  try { await load(SOLO_CITY_PATH, {signal}); return true; } catch { return false; }
}
